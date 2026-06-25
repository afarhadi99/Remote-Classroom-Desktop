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
      maxSessionMinutes: plan.maxSessionMinutes,
      monthlyMinutesPerStudent: plan.monthlyMinutesPerStudent,
      monthlyUnlimited: isUnlimited(plan.monthlyMinutesPerStudent),
    },
    planStatus: record.planStatus,
    currentPeriodEnd: record.currentPeriodEnd ? record.currentPeriodEnd.toISOString() : null,
    classCount,
    billingEnabled: stripeEnabled(),
    hasBillingAccount: !!record.stripeCustomerId,
  })
}
