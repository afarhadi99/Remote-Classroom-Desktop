import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getStripe, appUrl } from '@/lib/stripe'
import { PLANS } from '@/lib/plans'

export async function POST() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const stripe = getStripe()
  if (!stripe) {
    return apiError('Billing is not configured on this server (set STRIPE_SECRET_KEY).', 503)
  }

  const record = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!record) return apiError('Account not found.', 404)
  if (record.plan === 'pro') return apiError('You are already on the Pro plan.', 400)

  // ensure a Stripe customer
  let customerId = record.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: record.email,
      name: record.name,
      metadata: { teacherId: record.id },
    })
    customerId = customer.id
    await prisma.teacher.update({ where: { id: record.id }, data: { stripeCustomerId: customerId } })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: record.id,
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PLANS.pro.priceMonthly,
          recurring: { interval: 'month' },
          product_data: { name: 'Remote Classroom Desktop — Pro' },
        },
      },
    ],
    success_url: `${appUrl()}/teacher/billing?status=success`,
    cancel_url: `${appUrl()}/teacher/billing?status=canceled`,
    metadata: { teacherId: record.id },
  })

  return json({ url: session.url })
}
