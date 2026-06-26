import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getPlan, isUnlimited, currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']

// Org-wide admin console: every class, live desktop, raised hand, and the month's spend
// against the teacher's guardrails — one screen across the whole account.
export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const record = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!record) return apiError('Account not found.', 404)
  const plan = getPlan(record.plan)
  const month = currentUsageMonth()

  const classes = await prisma.classroom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
    include: {
      students: true,
      machines: { where: { status: { in: ACTIVE } }, include: { student: true } },
    },
  })

  const now = Date.now()
  const live: unknown[] = []
  const alerts: unknown[] = []
  let totalMinutes = 0
  let totalStudents = 0

  const perClass = classes.map((c) => {
    const minutes = c.students.reduce((sum, s) => sum + (s.usageMonth === month ? s.usageMinutes : 0), 0)
    totalMinutes += minutes
    totalStudents += c.students.length

    for (const m of c.machines) {
      live.push({
        machineId: m.id,
        classId: c.id,
        className: c.name,
        studentName: m.student?.name ?? null,
        os: m.os,
        status: m.status,
        remainingMs: m.status === 'RUNNING' && m.expiresAt ? m.expiresAt.getTime() - now : null,
      })
    }
    for (const s of c.students) {
      if (s.flaggedAt) {
        alerts.push({
          studentId: s.id,
          classId: c.id,
          className: c.name,
          name: s.name,
          kind: s.flagKind,
          note: s.flagNote,
          at: s.flaggedAt.toISOString(),
        })
      }
    }

    return {
      id: c.id,
      name: c.name,
      studentCount: c.students.length,
      liveCount: c.machines.length,
      minutes,
      costCents: estimateCostCents(minutes),
    }
  })

  alerts.sort((a, b) => ((a as { at: string }).at < (b as { at: string }).at ? 1 : -1))
  const liveCount = live.length
  const spentCents = estimateCostCents(totalMinutes)

  return json({
    teacher: { name: record.name, email: record.email },
    month,
    plan: { id: plan.id, name: plan.name },
    totals: {
      classes: classes.length,
      students: totalStudents,
      liveDesktops: liveCount,
      monthMinutes: totalMinutes,
      monthCostCents: spentCents,
    },
    guardrails: {
      maxConcurrentDesktops: record.maxConcurrentDesktops,
      concurrencyUsed: liveCount,
      monthlySpendCapCents: record.monthlySpendCapCents,
      spentCents,
    },
    billing: {
      planStatus: record.planStatus,
      currentPeriodEnd: record.currentPeriodEnd ? record.currentPeriodEnd.toISOString() : null,
      maxStudentsPerClass: plan.maxStudentsPerClass,
      maxStudentsUnlimited: isUnlimited(plan.maxStudentsPerClass),
    },
    live,
    alerts,
    classes: perClass,
  })
}
