import 'server-only'
import type { Machine, Student } from '@prisma/client'
import { prisma } from './prisma'
import { createDesktop, destroyDesktop, getOrCreateVolume, daytonaErrorMessage } from './daytona'
import type { OsType } from './os'

export const MACHINE_STATUS = {
  PENDING: 'PENDING',
  PROVISIONING: 'PROVISIONING',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
} as const

const ACTIVE_STATUSES = ['PROVISIONING', 'RUNNING'] as const

export interface SerializedMachine {
  id: string
  classroomId: string
  studentId: string | null
  studentName: string | null
  os: OsType
  status: string
  previewUrl: string | null
  errorMessage: string | null
  durationMin: number
  startedAt: string | null
  expiresAt: string | null
  remainingMs: number | null
}

export function serializeMachine(
  m: Machine & { student?: Student | null },
): SerializedMachine {
  const expiresAt = m.expiresAt ? new Date(m.expiresAt) : null
  const remainingMs =
    expiresAt && m.status === 'RUNNING' ? expiresAt.getTime() - Date.now() : null
  return {
    id: m.id,
    classroomId: m.classroomId,
    studentId: m.studentId,
    studentName: m.student?.name ?? null,
    os: m.os as OsType,
    status: m.status,
    previewUrl: m.status === 'RUNNING' ? m.previewUrl : null,
    errorMessage: m.errorMessage,
    durationMin: m.durationMin,
    startedAt: m.startedAt ? m.startedAt.toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    remainingMs,
  }
}

/**
 * Returns the active machine for a student, creating + provisioning a new one if needed.
 * Provisioning runs detached; the returned row is in PROVISIONING state.
 */
export async function bootMachineForStudent(params: {
  classroomId: string
  studentId: string
  os: OsType
  durationMin: number
}): Promise<Machine> {
  const existing = await prisma.machine.findFirst({
    where: {
      studentId: params.studentId,
      classroomId: params.classroomId,
      status: { in: ACTIVE_STATUSES as unknown as string[] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  const machine = await prisma.machine.create({
    data: {
      classroomId: params.classroomId,
      studentId: params.studentId,
      os: params.os,
      durationMin: params.durationMin,
      status: 'PROVISIONING',
    },
  })
  // fire-and-forget
  void provisionMachine(machine.id)
  return machine
}

/** Heavy lifting: create the Daytona desktop and flip the machine to RUNNING. */
export async function provisionMachine(machineId: string): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { student: true },
  })
  if (!machine) return

  try {
    let volumeId: string | undefined
    if (machine.student) {
      const volName = machine.student.volumeName || `rcd-vol-${machine.student.id}`
      const vol = await getOrCreateVolume(volName)
      volumeId = vol.id
      if (!machine.student.volumeId) {
        await prisma.student.update({
          where: { id: machine.student.id },
          data: { volumeId: vol.id, volumeName: volName },
        })
      }
    }

    const autoStop = Math.max(5, Math.min(machine.durationMin, 30))
    const handle = await createDesktop({
      os: machine.os as OsType,
      autoStopInterval: autoStop,
      volumeId,
      labels: { machineId },
    })

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + machine.durationMin * 60_000)

    await prisma.machine.update({
      where: { id: machineId },
      data: {
        status: 'RUNNING',
        sandboxId: handle.sandboxId,
        previewUrl: handle.previewUrl,
        startedAt,
        expiresAt,
        errorMessage: null,
      },
    })
  } catch (err) {
    await prisma.machine
      .update({
        where: { id: machineId },
        data: { status: 'ERROR', errorMessage: daytonaErrorMessage(err) },
      })
      .catch(() => {})
  }
}

/** Stops + deletes the Daytona sandbox; the student's volume (files) persists. */
export async function stopMachine(machineId: string): Promise<void> {
  const machine = await prisma.machine.findUnique({ where: { id: machineId } })
  if (!machine) return
  await prisma.machine
    .update({ where: { id: machineId }, data: { status: 'STOPPING' } })
    .catch(() => {})
  if (machine.sandboxId) {
    await destroyDesktop(machine.sandboxId)
  }
  await prisma.machine
    .update({
      where: { id: machineId },
      data: { status: 'STOPPED', stoppedAt: new Date(), previewUrl: null },
    })
    .catch(() => {})
}

/** Stops every active machine in a classroom. */
export async function stopClassroomMachines(classroomId: string): Promise<number> {
  const machines = await prisma.machine.findMany({
    where: { classroomId, status: { in: ACTIVE_STATUSES as unknown as string[] } },
  })
  await Promise.all(machines.map((m) => stopMachine(m.id)))
  return machines.length
}

/**
 * Enforces the hard time limit: any RUNNING machine past expiresAt is torn down.
 * Also fails machines stuck PROVISIONING for too long.
 */
export async function sweepExpiredMachines(): Promise<{ expired: number; stuck: number }> {
  const now = new Date()

  const expired = await prisma.machine.findMany({
    where: { status: 'RUNNING', expiresAt: { lte: now } },
  })
  for (const m of expired) {
    await prisma.machine
      .update({ where: { id: m.id }, data: { status: 'EXPIRED', previewUrl: null } })
      .catch(() => {})
    if (m.sandboxId) await destroyDesktop(m.sandboxId)
    await prisma.machine
      .update({ where: { id: m.id }, data: { stoppedAt: now } })
      .catch(() => {})
  }

  // Provisioning longer than 6 minutes is almost certainly wedged.
  const cutoff = new Date(now.getTime() - 6 * 60_000)
  const stuck = await prisma.machine.findMany({
    where: { status: 'PROVISIONING', createdAt: { lte: cutoff } },
  })
  for (const m of stuck) {
    await prisma.machine
      .update({
        where: { id: m.id },
        data: { status: 'ERROR', errorMessage: 'Provisioning timed out. Please try again.' },
      })
      .catch(() => {})
    if (m.sandboxId) await destroyDesktop(m.sandboxId)
  }

  return { expired: expired.length, stuck: stuck.length }
}
