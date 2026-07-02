import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getPlan, isUnlimited } from '@/lib/plans'
import { stripeEnabled } from '@/lib/stripe'

export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const record = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!record) return apiError('Account not found.', 404)

  const plan = getPlan(record.plan)
  const classCount = await prisma.classroom.count({ where: { teacherId: teacher.id } })

  return json({
    teacher: { id: record.id, name: record.name, email: record.email },
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      maxClasses: plan.maxClasses,
      maxClassesUnlimited: isUnlimited(plan.maxClasses),
      maxStudentsPerClass: plan.maxStudentsPerClass,
      maxStudentsUnlimited: isUnlimited(plan.maxStudentsPerClass),
      maxSessionMinutes: plan.maxSessionMinutes,
      monthlyMinutesPerStudent: plan.monthlyMinutesPerStudent,
      monthlyUnlimited: isUnlimited(plan.monthlyMinutesPerStudent),
    },
    planStatus: record.planStatus,
    currentPeriodEnd: record.currentPeriodEnd ? record.currentPeriodEnd.toISOString() : null,
    classCount,
    billingEnabled: stripeEnabled(),
    hasBillingAccount: !!record.stripeCustomerId,
    guardrails: {
      maxConcurrentDesktops: record.maxConcurrentDesktops,
      monthlySpendCapCents: record.monthlySpendCapCents,
    },
    totpEnabled: record.totpEnabled,
  })
}

const guardrailSchema = z.object({
  maxConcurrentDesktops: z.number().int().min(0).max(1000).nullable(), // 0 = freeze all boots
  monthlySpendCapCents: z.number().int().min(0).max(100_000_00).nullable(),
})

// Update cost guardrails.
export async function PATCH(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const parsed = guardrailSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid guardrail values.')

  await prisma.teacher.update({ where: { id: teacher.id }, data: parsed.data })
  return json({ ok: true })
}
