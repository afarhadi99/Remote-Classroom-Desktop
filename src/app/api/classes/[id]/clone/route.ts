import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { generateJoinCode } from '@/lib/utils'
import { getPlan, isUnlimited } from '@/lib/plans'

// Duplicate a class's configuration (OS, golden image, time/idle limits, internet policy,
// exam + PIN settings, and recurring schedule) into a brand-new class with a fresh join code.
// Students, machines and groups are NOT copied — it's a clean section of the same lesson.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const source = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!source) return apiError('Class not found.', 404)

  // Honor the plan's class cap, exactly like creating a class.
  const teacherRecord = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  const plan = getPlan(teacherRecord?.plan)
  const classCount = await prisma.classroom.count({ where: { teacherId: teacher.id } })
  if (!isUnlimited(plan.maxClasses) && classCount >= plan.maxClasses) {
    return apiError(
      `Your ${plan.name} plan includes ${plan.maxClasses} class${plan.maxClasses === 1 ? '' : 'es'}. Upgrade to Pro to clone classes.`,
      402,
    )
  }

  // Fresh unique join code.
  let joinCode = generateJoinCode()
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.classroom.findUnique({ where: { joinCode } }))) break
    joinCode = generateJoinCode()
  }

  const created = await prisma.$transaction(async (tx) => {
    const clone = await tx.classroom.create({
      data: {
        name: `${source.name} (copy)`.slice(0, 80),
        joinCode,
        teacherId: teacher.id,
        defaultOs: source.defaultOs,
        snapshot: source.snapshot,
        defaultDurationMin: source.defaultDurationMin,
        allowStudentBoot: source.allowStudentBoot,
        idleTimeoutMin: source.idleTimeoutMin,
        netMode: source.netMode,
        allowedDomains: source.allowedDomains,
        examMode: source.examMode,
        examMessage: source.examMessage,
        requireJoinPin: source.requireJoinPin,
      },
    })
    const schedules = await tx.classSchedule.findMany({ where: { classroomId: id } })
    if (schedules.length) {
      await tx.classSchedule.createMany({
        data: schedules.map((s) => ({
          classroomId: clone.id,
          weekday: s.weekday,
          startMinute: s.startMinute,
          durationMin: s.durationMin,
          endMinute: s.endMinute,
          os: s.os,
          enabled: s.enabled,
          // lastRunOn / lastShutdownOn intentionally reset so the new class can fire today.
        })),
      })
    }
    return clone
  })

  return json({ ok: true, classroom: { id: created.id, joinCode: created.joinCode } })
}
