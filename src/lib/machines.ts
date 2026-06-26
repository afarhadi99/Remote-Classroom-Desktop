import 'server-only'
import type { Machine, Student } from '@prisma/client'
import { prisma } from './prisma'
import { createDesktop, destroyDesktop, getOrCreateVolume, daytonaErrorMessage } from './daytona'
import type { OsType } from './os'
import { getPlan, isUnlimited, currentUsageMonth, type Plan } from './plans'
import { logEvent } from './events'
import { estimateCostCents } from './cost'

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

// ---------------------------------------------------------------------------
// Usage + plan limits
// ---------------------------------------------------------------------------

export interface MonthlyUsage {
  used: number
  limit: number
  remaining: number
  unlimited: boolean
}

export function monthlyUsage(student: Student, plan: Plan): MonthlyUsage {
  const month = currentUsageMonth()
  const used = student.usageMonth === month ? student.usageMinutes : 0
  const limit = plan.monthlyMinutesPerStudent
  const unlimited = isUnlimited(limit)
  const remaining = unlimited ? limit : Math.max(0, limit - used)
  return { used, limit, remaining, unlimited }
}

/** Adds a finished machine's runtime to the student's monthly usage. */
async function accrueUsage(machine: Machine, endedAt: Date): Promise<void> {
  if (!machine.studentId || !machine.startedAt) return
  const minutes = Math.max(
    1,
    Math.round((endedAt.getTime() - machine.startedAt.getTime()) / 60_000),
  )
  const month = currentUsageMonth()
  const student = await prisma.student.findUnique({ where: { id: machine.studentId } })
  if (!student) return
  const base = student.usageMonth === month ? student.usageMinutes : 0
  await prisma.student
    .update({
      where: { id: student.id },
      data: { usageMonth: month, usageMinutes: base + minutes },
    })
    .catch(() => {})
}

export type BootResult =
  | { ok: true; machine: Machine }
  | { ok: false; reason: string; studentReason: string }

/**
 * Returns the active machine for a student, creating + provisioning a new one if
 * the student's plan limits allow. Provisioning runs detached.
 */
export async function bootMachineForStudent(params: {
  classroomId: string
  studentId: string
  os: OsType
  durationMin: number
}): Promise<BootResult> {
  const existing = await prisma.machine.findFirst({
    where: {
      studentId: params.studentId,
      classroomId: params.classroomId,
      status: { in: ACTIVE_STATUSES as unknown as string[] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return { ok: true, machine: existing }

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: { classroom: { include: { teacher: true } } },
  })
  if (!student) {
    return { ok: false, reason: 'Student not found.', studentReason: 'Something went wrong.' }
  }

  const teacher = student.classroom.teacher
  const plan = getPlan(teacher.plan)
  const usage = monthlyUsage(student, plan)
  if (usage.remaining <= 0) {
    return {
      ok: false,
      reason: `${student.name} has used all ${plan.monthlyMinutesPerStudent} desktop minutes for this month. Upgrade to Pro for unlimited student minutes.`,
      studentReason:
        "You've used all of your desktop time for this month. Ask your teacher if you need more.",
    }
  }

  // Cost guardrails (teacher-configured caps across all their classes).
  if (teacher.maxConcurrentDesktops != null) {
    const active = await prisma.machine.count({
      where: { classroom: { teacherId: teacher.id }, status: { in: ACTIVE_STATUSES as unknown as string[] } },
    })
    if (active >= teacher.maxConcurrentDesktops) {
      return {
        ok: false,
        reason: `You've hit your concurrency limit of ${teacher.maxConcurrentDesktops} running desktops. Stop one or raise the limit under Plan & billing.`,
        studentReason: 'Your class has hit its limit of running desktops. Ask your teacher.',
      }
    }
  }
  if (teacher.monthlySpendCapCents != null) {
    const agg = await prisma.student.aggregate({
      where: { classroom: { teacherId: teacher.id }, usageMonth: currentUsageMonth() },
      _sum: { usageMinutes: true },
    })
    const spentCents = estimateCostCents(agg._sum.usageMinutes ?? 0)
    if (spentCents >= teacher.monthlySpendCapCents) {
      return {
        ok: false,
        reason: `You've reached your monthly spend cap (~$${(teacher.monthlySpendCapCents / 100).toFixed(2)}). Raise it under Plan & billing to keep booting.`,
        studentReason: 'Your class has used its desktop budget for the month. Ask your teacher.',
      }
    }
  }

  // Clamp the session to the plan's session cap and the student's remaining minutes.
  const cap = Math.min(params.durationMin, plan.maxSessionMinutes)
  const durationMin = Math.max(5, usage.unlimited ? cap : Math.min(cap, usage.remaining))

  const machine = await prisma.machine.create({
    data: {
      classroomId: params.classroomId,
      studentId: params.studentId,
      os: params.os,
      durationMin,
      status: 'PROVISIONING',
    },
  })
  void provisionMachine(machine.id)
  return { ok: true, machine }
}

/** Heavy lifting: create the Daytona desktop and flip the machine to RUNNING. */
export async function provisionMachine(machineId: string): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { student: true, classroom: true },
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

    // Idle reclaim: Daytona auto-stops the sandbox after this many inactive minutes.
    const idle = machine.classroom?.idleTimeoutMin ?? 20
    const autoStop = idle > 0 ? Math.max(5, idle) : 0
    // Internet policy (enforced at the Daytona network layer).
    const netMode = machine.classroom?.netMode ?? 'open'
    const allowed = machine.classroom?.allowedDomains?.trim()
    const handle = await createDesktop({
      os: machine.os as OsType,
      autoStopInterval: autoStop,
      volumeId,
      labels: { machineId },
      networkBlockAll: netMode === 'blocked',
      domainAllowList: netMode === 'allowlist' && allowed ? allowed : undefined,
    })

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + machine.durationMin * 60_000)

    await prisma.machine.update({
      where: { id: machineId },
      data: {
        status: 'RUNNING',
        sandboxId: handle.sandboxId,
        previewUrl: handle.previewUrl,
        previewToken: handle.previewToken,
        startedAt,
        expiresAt,
        errorMessage: null,
      },
    })
    await logEvent({
      classroomId: machine.classroomId,
      studentId: machine.studentId,
      type: 'running',
      message: `${machine.student?.name ?? 'A student'}'s ${machine.os} desktop is ready`,
    })
  } catch (err) {
    const msg = daytonaErrorMessage(err)
    await prisma.machine
      .update({ where: { id: machineId }, data: { status: 'ERROR', errorMessage: msg } })
      .catch(() => {})
    await logEvent({
      classroomId: machine.classroomId,
      studentId: machine.studentId,
      type: 'error',
      message: `Desktop for ${machine.student?.name ?? 'a student'} failed: ${msg}`,
    })
  }
}

/** Stops + deletes the Daytona sandbox; the student's volume (files) persists. */
export async function stopMachine(machineId: string): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { student: true },
  })
  if (!machine) return
  await prisma.machine
    .update({ where: { id: machineId }, data: { status: 'STOPPING' } })
    .catch(() => {})
  if (machine.sandboxId) {
    await destroyDesktop(machine.sandboxId)
  }
  const stoppedAt = new Date()
  await accrueUsage(machine, stoppedAt)
  await prisma.machine
    .update({
      where: { id: machineId },
      data: { status: 'STOPPED', stoppedAt, previewUrl: null },
    })
    .catch(() => {})
  await logEvent({
    classroomId: machine.classroomId,
    studentId: machine.studentId,
    type: 'stopped',
    message: `${machine.student?.name ?? 'A student'}'s desktop was shut down`,
  })
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Fires any weekly schedule slot whose start time has arrived (server local time),
 * booting every student's desktop. Idempotent per day via ClassSchedule.lastRunOn.
 * Teardown is automatic — booted machines carry the slot's durationMin expiry.
 */
export async function runScheduledBoots(now: Date = new Date()): Promise<number> {
  const weekday = now.getDay()
  const minuteOfDay = now.getHours() * 60 + now.getMinutes()
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const LEAD = 2 // pre-warm up to 2 minutes early
  const WINDOW = 3 // catch the slot within a few minutes of its start

  const due = await prisma.classSchedule.findMany({ where: { enabled: true, weekday } })
  let fired = 0
  for (const s of due) {
    if (s.lastRunOn === todayStr) continue
    if (minuteOfDay < s.startMinute - LEAD || minuteOfDay > s.startMinute + WINDOW) continue

    // mark fired BEFORE booting so overlapping sweeper ticks don't double-fire
    await prisma.classSchedule.update({ where: { id: s.id }, data: { lastRunOn: todayStr } }).catch(() => {})

    const students = await prisma.student.findMany({ where: { classroomId: s.classroomId } })
    let booted = 0
    for (const st of students) {
      const r = await bootMachineForStudent({
        classroomId: s.classroomId,
        studentId: st.id,
        os: s.os as OsType,
        durationMin: s.durationMin,
      })
      if (r.ok) booted++
    }
    await logEvent({
      classroomId: s.classroomId,
      type: 'provision_all',
      actorRole: 'system',
      message: `Scheduled auto-boot started ${booted} desktop${booted === 1 ? '' : 's'}`,
    })
    fired++
  }
  return fired
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
    include: { student: true },
  })
  for (const m of expired) {
    await prisma.machine
      .update({ where: { id: m.id }, data: { status: 'EXPIRED', previewUrl: null } })
      .catch(() => {})
    if (m.sandboxId) await destroyDesktop(m.sandboxId)
    await accrueUsage(m, now)
    await prisma.machine
      .update({ where: { id: m.id }, data: { stoppedAt: now } })
      .catch(() => {})
    await logEvent({
      classroomId: m.classroomId,
      studentId: m.studentId,
      type: 'expired',
      message: `${m.student?.name ?? 'A student'}'s desktop hit its time limit and shut down`,
    })
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
