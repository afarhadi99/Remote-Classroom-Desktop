import { prisma } from '@/lib/prisma'
import { apiError, getAdmin, json } from '@/lib/api'
import { getPlan, currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']

// List every teacher with subscription + usage rollups for the admin console. Optional ?q search.
export async function GET(req: Request) {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)

  const q = new URL(req.url).searchParams.get('q')?.trim()
  const month = currentUsageMonth()

  const teachers = await prisma.teacher.findMany({
    where: q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      classes: {
        select: {
          _count: { select: { students: true, machines: true } },
          students: { select: { usageMonth: true, usageMinutes: true } },
          machines: { where: { status: { in: ACTIVE } }, select: { id: true } },
        },
      },
    },
  })

  return json({
    teachers: teachers.map((t) => {
      const studentCount = t.classes.reduce((s, c) => s + c._count.students, 0)
      const liveDesktops = t.classes.reduce((s, c) => s + c.machines.length, 0)
      const monthMinutes = t.classes.reduce(
        (s, c) => s + c.students.reduce((a, st) => a + (st.usageMonth === month ? st.usageMinutes : 0), 0),
        0,
      )
      const plan = getPlan(t.plan)
      return {
        id: t.id,
        name: t.name,
        email: t.email,
        plan: t.plan,
        planLabel: plan.name,
        planStatus: t.planStatus,
        currentPeriodEnd: t.currentPeriodEnd ? t.currentPeriodEnd.toISOString() : null,
        hasStripe: !!t.stripeCustomerId,
        classCount: t.classes.length,
        studentCount,
        liveDesktops,
        monthMinutes,
        monthCostCents: estimateCostCents(monthMinutes),
        maxConcurrentDesktops: t.maxConcurrentDesktops,
        monthlySpendCapCents: t.monthlySpendCapCents,
        createdAt: t.createdAt.toISOString(),
      }
    }),
  })
}
