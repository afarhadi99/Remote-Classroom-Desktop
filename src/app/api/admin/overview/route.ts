import { prisma } from '@/lib/prisma'
import { apiError, getAdmin, json } from '@/lib/api'
import { getPlan, currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']

// Platform-wide snapshot for the super-admin dashboard.
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const month = currentUsageMonth()

  const [teachers, students, classes, activeDesktops, byPlan, usage, recent] = await Promise.all([
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.classroom.count(),
    prisma.machine.count({ where: { status: { in: ACTIVE } } }),
    prisma.teacher.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.student.aggregate({ where: { usageMonth: month }, _sum: { usageMinutes: true } }),
    prisma.teacher.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, email: true, plan: true, createdAt: true } }),
  ])

  const plans: Record<string, number> = {}
  for (const row of byPlan) plans[row.plan] = row._count._all
  const proCount = plans['pro'] ?? 0
  const mrrCents = proCount * getPlan('pro').priceMonthly * 100
  const monthMinutes = usage._sum.usageMinutes ?? 0

  return json({
    admin: { name: admin.name, email: admin.email },
    month,
    totals: {
      teachers,
      students,
      classes,
      activeDesktops,
      monthMinutes,
      monthCostCents: estimateCostCents(monthMinutes),
    },
    subscriptions: { free: plans['free'] ?? 0, pro: proCount, mrrCents },
    recentTeachers: recent.map((t) => ({ id: t.id, name: t.name, email: t.email, plan: t.plan, createdAt: t.createdAt.toISOString() })),
  })
}
