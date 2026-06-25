import type Stripe from 'stripe'
import { getStripe, syncSubscription } from '@/lib/stripe'

// Stripe webhook. Verifies the signature (when STRIPE_WEBHOOK_SECRET is set) and
// keeps the teacher's plan in sync with their subscription.
export async function POST(req: Request) {
  const stripe = getStripe()
  if (!stripe) return new Response('billing disabled', { status: 200 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event =
      secret && sig
        ? stripe.webhooks.constructEvent(body, sig, secret)
        : (JSON.parse(body) as Stripe.Event)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${(err as Error).message}`, {
      status: 400,
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          await syncSubscription(stripe, String(session.subscription))
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(stripe, sub.id)
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', err)
    return new Response('handler error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
