import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { serializeMachine, stopClassroomMachines, monthlyUsage } from '@/lib/machines'
import { isOsType } from '@/lib/os'
import { getPlan, isUnlimited } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'
import { logEvent } from '@/lib/events'

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  const teacherRecord = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  const plan = getPlan(teacherRecord?.plan)

  const [students, machines, groups] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId: id },
      orderBy: { name: 'asc' },
      include: { machines: { orderBy: { createdAt: 'desc' }, take: 1, include: { student: true } } },
    }),
    prisma.machine.findMany({
      where: { classroomId: id },
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    }),
    prisma.classGroup.findMany({
      where: { classroomId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        students: { select: { id: true, name: true } },
        machines: {
          where: { status: { in: ['PROVISIONING', 'RUNNING'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { group: true },
        },
      },
    }),
  ])

  const totalUsedMinutes = students.reduce((sum, s) => sum + monthlyUsage(s, plan).used, 0)

  return json({
    classroom: {
      id: classroom.id,
      name: classroom.name,
      joinCode: classroom.joinCode,
      defaultOs: classroom.defaultOs,
      snapshot: classroom.snapshot,
      defaultDurationMin: classroom.defaultDurationMin,
      allowStudentBoot: classroom.allowStudentBoot,
      idleTimeoutMin: classroom.idleTimeoutMin,
      netMode: classroom.netMode,
      allowedDomains: classroom.allowedDomains,
      examMode: classroom.examMode,
      examMessage: classroom.examMessage,
      requireJoinPin: classroom.requireJoinPin,
      announcement: classroom.announcement,
      locked: !!classroom.lockedAt,
      createdAt: classroom.createdAt.toISOString(),
    },
    plan: {
      id: plan.id,
      name: plan.name,
      maxSessionMinutes: plan.maxSessionMinutes,
      maxStudentsPerClass: plan.maxStudentsPerClass,
      maxStudentsUnlimited: isUnlimited(plan.maxStudentsPerClass),
      monthlyMinutesPerStudent: plan.monthlyMinutesPerStudent,
      monthlyUnlimited: isUnlimited(plan.monthlyMinutesPerStudent),
    },
    students: students.map((s) => {
      const usage = monthlyUsage(s, plan)
      return {
        id: s.id,
        name: s.name,
        joinedAt: s.joinedAt.toISOString(),
        machine: s.machines[0] ? serializeMachine(s.machines[0]) : null,
        usage: { used: usage.used, remaining: usage.remaining, unlimited: usage.unlimited },
        flag: s.flaggedAt
          ? { kind: s.flagKind, note: s.flagNote, at: s.flaggedAt.toISOString() }
          : null,
        groupId: s.groupId,
        hasPin: !!s.joinPin,
      }
    }),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      students: g.students,
      machine: g.machines[0] ? serializeMachine(g.machines[0]) : null,
    })),
    usageSummary: {
      totalMinutes: totalUsedMinutes,
      estimatedCostCents: estimateCostCents(totalUsedMinutes),
    },
    machines: machines.map((m) => serializeMachine(m)),
  })
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  defaultOs: z.string().refine(isOsType, 'Invalid OS').optional(),
  snapshot: z.string().trim().max(200).nullable().optional(),
  defaultDurationMin: z.number().int().min(5).max(480).optional(),
  allowStudentBoot: z.boolean().optional(),
  idleTimeoutMin: z.number().int().min(0).max(120).optional(),
  netMode: z.enum(['open', 'allowlist', 'blocked']).optional(),
  allowedDomains: z.string().max(2000).nullable().optional(),
  examMode: z.boolean().optional(),
  examMessage: z.string().max(200).nullable().optional(),
  requireJoinPin: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid settings.')

  // clamp session length to the teacher's plan cap
  const data = { ...parsed.data }
  if (typeof data.snapshot === 'string' && data.snapshot.trim() === '') data.snapshot = null
  if (typeof data.defaultDurationMin === 'number') {
    const teacherRecord = await prisma.teacher.findUnique({ where: { id: teacher.id } })
    const plan = getPlan(teacherRecord?.plan)
    data.defaultDurationMin = Math.min(data.defaultDurationMin, plan.maxSessionMinutes)
  }

  const updated = await prisma.classroom.update({ where: { id }, data })

  if (typeof data.examMode === 'boolean' && data.examMode !== classroom.examMode) {
    await logEvent({
      classroomId: id,
      type: 'exam',
      actorRole: 'teacher',
      message: data.examMode ? 'Started exam mode' : 'Ended exam mode',
    })
  }

  return json({ ok: true, classroom: { id: updated.id, name: updated.name } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  // tear down running desktops first, then delete the class (cascades students/machines)
  await stopClassroomMachines(id)
  await prisma.classroom.delete({ where: { id } })
  return json({ ok: true })
}
