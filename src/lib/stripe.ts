import 'server-only'
import Stripe from 'stripe'
import { prisma } from './prisma'

let client: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function appUrl(): string {
  return process.env.APP_URL || 'http://localhost:3000'
}

/**
 * Retrieves a subscription and writes its state onto the matching teacher.
 * Active/trialing -> pro; anything else -> free.
 */
export async function syncSubscription(stripe: Stripe, subscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const teacher = await prisma.teacher.findFirst({ where: { stripeCustomerId: customerId } })
  if (!teacher) return

  const active = sub.status === 'active' || sub.status === 'trialing'
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
  await prisma.teacher.update({
    where: { id: teacher.id },
    data: {
      plan: active ? 'pro' : 'free',
      planStatus: sub.status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  })
}
