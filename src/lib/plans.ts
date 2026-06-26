// Plan definitions + limits. Client-safe (no server imports) so the UI can render pricing.

export type PlanId = 'free' | 'pro'

export const UNLIMITED = 1_000_000 // sentinel for "unlimited" (minutes/classes)

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** Price in USD cents, per teacher per month. */
  priceMonthly: number
  maxClasses: number
  maxStudentsPerClass: number
  maxSessionMinutes: number
  monthlyMinutesPerStudent: number
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Perfect for trying it out with a single class.',
    priceMonthly: 0,
    maxClasses: 1,
    maxStudentsPerClass: 30,
    maxSessionMinutes: 45,
    monthlyMinutesPerStudent: 200,
    features: [
      '1 class, up to 30 students',
      'Sessions up to 45 minutes',
      '200 desktop minutes / student / month',
      'Full Linux desktops in the browser',
      'Persistent storage for every student',
      'Auto-shutdown + time warnings',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For real classrooms running all year.',
    priceMonthly: 1900, // $19 / month
    maxClasses: UNLIMITED,
    maxStudentsPerClass: UNLIMITED,
    maxSessionMinutes: 240,
    monthlyMinutesPerStudent: UNLIMITED,
    features: [
      'Unlimited classes & students',
      'Sessions up to 4 hours',
      'Unlimited student desktop minutes',
      'Linux & Windows desktops*',
      'Persistent storage for every student',
      'Watch any student’s desktop live',
      'Priority provisioning',
    ],
  },
}

// Annual Pro: pay for 10 months, get 12 (~2 months free).
export const PRO_ANNUAL_CENTS = PLANS.pro.priceMonthly * 10

export type BillingCycle = 'monthly' | 'annual'

export function getPlan(id?: string | null): Plan {
  return id === 'pro' ? PLANS.pro : PLANS.free
}

export function isUnlimited(n: number): boolean {
  return n >= UNLIMITED
}

/** Current usage period as "YYYY-MM". */
export function currentUsageMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

export function formatLimitMinutes(n: number): string {
  return isUnlimited(n) ? 'Unlimited' : `${n} min`
}

export function formatPrice(cents: number): string {
  if (cents === 0) return '$0'
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
