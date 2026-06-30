import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getAdmin, json } from '@/lib/api'
import { getPlan, currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'
import { stopClassroomMachines } from '@/lib/machines'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const { id } = await params

  const t = await prisma.teacher.findUnique({
    where: { id },
    include: {
      classes: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { students: true } },
          students: { select: { usageMonth: true, usageMinutes: true } },
          machines: { where: { status: { in: ACTIVE } }, select: { id: true } },
        },
      },
    },
  })
  if (!t) return apiError('Teacher not found.', 404)
  const month = currentUsageMonth()
  const plan = getPlan(t.plan)

  return json({
    teacher: {
      id: t.id,
      name: t.name,
      email: t.email,
      plan: t.plan,
      planLabel: plan.name,
      planStatus: t.planStatus,
      currentPeriodEnd: t.currentPeriodEnd ? t.currentPeriodEnd.toISOString() : null,
      hasStripe: !!t.stripeCustomerId,
      maxConcurrentDesktops: t.maxConcurrentDesktops,
      monthlySpendCapCents: t.monthlySpendCapCents,
      createdAt: t.createdAt.toISOString(),
    },
    classes: t.classes.map((c) => {
      const minutes = c.students.reduce((a, st) => a + (st.usageMonth === month ? st.usageMinutes : 0), 0)
      return {
        id: c.id,
        name: c.name,
        joinCode: c.joinCode,
        studentCount: c._count.students,
        liveDesktops: c.machines.length,
        monthMinutes: minutes,
        monthCostCents: estimateCostCents(minutes),
      }
    }),
  })
}

const patchSchema = z.object({
  plan: z.enum(['free', 'pro']).optional(),
  planStatus: z.string().max(40).nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  maxConcurrentDesktops: z.number().int().min(0).max(100000).nullable().optional(),
  monthlySpendCapCents: z.number().int().min(0).max(100000000).nullable().optional(),
})

// Admin override of a teacher's subscription + guardrails (bypasses Stripe — e.g. comp Pro).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const { id } = await params

  const teacher = await prisma.teacher.findUnique({ where: { id } })
  if (!teacher) return apiError('Teacher not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid override.')

  const data: Record<string, unknown> = {}
  if (parsed.data.plan !== undefined) data.plan = parsed.data.plan
  if (parsed.data.planStatus !== undefined) data.planStatus = parsed.data.planStatus
  if (parsed.data.currentPeriodEnd !== undefined)
    data.currentPeriodEnd = parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null
  if (parsed.data.maxConcurrentDesktops !== undefined) data.maxConcurrentDesktops = parsed.data.maxConcurrentDesktops
  if (parsed.data.monthlySpendCapCents !== undefined) data.monthlySpendCapCents = parsed.data.monthlySpendCapCents

  const updated = await prisma.teacher.update({ where: { id }, data })
  return json({ ok: true, teacher: { id: updated.id, plan: updated.plan, planStatus: updated.planStatus } })
}

// Hard stop: shut down every running desktop a teacher owns (admin override).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const { id } = await params
  const classes = await prisma.classroom.findMany({ where: { teacherId: id }, select: { id: true } })
  let stopped = 0
  for (const c of classes) stopped += await stopClassroomMachines(c.id)
  return json({ ok: true, stopped })
}
