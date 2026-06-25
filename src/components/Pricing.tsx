'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles, Loader2 } from 'lucide-react'
import { PLANS, formatPrice } from '@/lib/plans'
import { api } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/utils'

export function PricingCards({
  variant = 'public',
  currentPlan,
}: {
  variant?: 'public' | 'billing'
  currentPlan?: 'free' | 'pro'
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function upgrade() {
    setLoading(true)
    try {
      const { url } = await api<{ url: string }>('/api/billing/checkout', { method: 'POST' })
      window.location.href = url
    } catch (e) {
      toast.error('Could not start checkout', (e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Free */}
      <PlanCard
        plan={PLANS.free}
        highlight={false}
        current={variant === 'billing' && currentPlan === 'free'}
        cta={
          variant === 'public' ? (
            <Link href="/teacher/signup" className="btn-ghost w-full">
              Start free
            </Link>
          ) : currentPlan === 'free' ? (
            <span className="btn-ghost w-full cursor-default opacity-70">Your current plan</span>
          ) : (
            <span className="btn-ghost w-full cursor-default opacity-70">Included</span>
          )
        }
      />

      {/* Pro */}
      <PlanCard
        plan={PLANS.pro}
        highlight
        current={variant === 'billing' && currentPlan === 'pro'}
        cta={
          variant === 'public' ? (
            <Link href="/teacher/signup" className="btn-primary w-full">
              <Sparkles className="size-4" /> Get started with Pro
            </Link>
          ) : currentPlan === 'pro' ? (
            <span className="btn-primary w-full cursor-default opacity-80">
              <Check className="size-4" /> You’re on Pro
            </span>
          ) : (
            <button onClick={upgrade} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="size-4 animate-rcd-spin" /> : <Sparkles className="size-4" />}
              Upgrade to Pro
            </button>
          )
        }
      />
    </div>
  )
}

function PlanCard({
  plan,
  highlight,
  current,
  cta,
}: {
  plan: (typeof PLANS)[keyof typeof PLANS]
  highlight: boolean
  current: boolean
  cta: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6',
        highlight
          ? 'border-indigo-400/40 bg-gradient-to-b from-indigo-500/10 to-transparent shadow-xl shadow-indigo-950/30'
          : 'border-white/10 bg-white/[0.03]',
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
          Most popular
        </span>
      )}
      {current && (
        <span className="absolute -top-3 right-6 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
          Current
        </span>
      )}
      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
      <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tight text-white">
          {formatPrice(plan.priceMonthly)}
        </span>
        <span className="mb-1 text-sm text-slate-400">{plan.priceMonthly ? '/ month' : 'forever'}</span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
            <Check
              className={cn('mt-0.5 size-4 shrink-0', highlight ? 'text-indigo-300' : 'text-emerald-400')}
            />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
      {plan.id === 'pro' && (
        <p className="mt-3 text-center text-[11px] text-slate-500">
          *Windows requires the Windows class enabled on your Daytona organization.
        </p>
      )}
    </div>
  )
}
