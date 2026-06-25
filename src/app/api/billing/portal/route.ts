import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getStripe, appUrl } from '@/lib/stripe'

export async function POST() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const stripe = getStripe()
  if (!stripe) return apiError('Billing is not configured on this server.', 503)

  const record = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!record?.stripeCustomerId) {
    return apiError('No billing account yet — upgrade first.', 400)
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: `${appUrl()}/teacher/billing`,
  })
  return json({ url: session.url })
}
