'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Sparkles, Layers, Clock, Users, Loader2 } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { PricingCards } from '@/components/Pricing'
import { useToast } from '@/components/Toast'
import { api, formatDurationLabel } from '@/lib/client'

interface Account {
  teacher: { name: string; email: string }
  plan: {
    id: 'free' | 'pro'
    name: string
    maxClasses: number
    maxClassesUnlimited: boolean
    maxSessionMinutes: number
    monthlyMinutesPerStudent: number
    monthlyUnlimited: boolean
  }
  planStatus: string | null
  currentPeriodEnd: string | null
  classCount: number
  billingEnabled: boolean
  hasBillingAccount: boolean
}

export function BillingPanel() {
  const toast = useToast()
  const [account, setAccount] = useState<Account | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setAccount(await api<Account>('/api/teacher/account'))
    } catch (e) {
      toast.error('Could not load billing', (e as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
    const status = new URLSearchParams(window.location.search).get('status')
    if (status === 'success') {
      toast.success('Welcome to Pro! 🎉', 'Your plan is being activated.')
      // the webhook may take a moment; refetch a few times
      const tries = [1500, 4000, 8000]
      tries.forEach((ms) => setTimeout(load, ms))
      window.history.replaceState({}, '', '/teacher/billing')
    } else if (status === 'canceled') {
      toast.info('Checkout canceled', 'No changes were made to your plan.')
      window.history.replaceState({}, '', '/teacher/billing')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function manage() {
    setPortalLoading(true)
    try {
      const { url } = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
      window.location.href = url
    } catch (e) {
      toast.error('Could not open billing portal', (e as Error).message)
      setPortalLoading(false)
    }
  }

  if (!account) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 justify-center px-5 py-20 text-slate-500">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { plan } = account
  const renews = account.currentPeriodEnd ? new Date(account.currentPeriodEnd) : null

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="size-4" /> Back to classes
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Plan &amp; billing</h1>

      {/* current plan summary */}
      <div className="mt-5 card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              {plan.id === 'pro' ? <Sparkles className="size-5" /> : <Layers className="size-5" />}
            </span>
            <div>
              <p className="text-lg font-semibold text-white">{plan.name} plan</p>
              <p className="text-sm text-slate-400">
                {account.planStatus
                  ? `Status: ${account.planStatus}${renews ? ` · renews ${renews.toLocaleDateString()}` : ''}`
                  : 'No subscription — you’re on the free tier.'}
              </p>
            </div>
          </div>
          {account.hasBillingAccount && (
            <button onClick={manage} disabled={portalLoading} className="btn-ghost">
              {portalLoading ? <Loader2 className="size-4 animate-rcd-spin" /> : <CreditCard className="size-4" />}
              Manage billing
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat
            icon={<Layers className="size-4 text-indigo-300" />}
            label="Classes"
            value={`${account.classCount} / ${plan.maxClassesUnlimited ? '∞' : plan.maxClasses}`}
          />
          <Stat
            icon={<Clock className="size-4 text-amber-300" />}
            label="Max session"
            value={formatDurationLabel(plan.maxSessionMinutes)}
          />
          <Stat
            icon={<Users className="size-4 text-cyan-300" />}
            label="Per student / month"
            value={plan.monthlyUnlimited ? 'Unlimited' : `${plan.monthlyMinutesPerStudent} min`}
          />
        </div>
      </div>

      {!account.billingEnabled && (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Upgrades aren’t configured on this server yet (no Stripe key). The free tier is fully
          functional; add <code className="font-mono">STRIPE_SECRET_KEY</code> to enable Pro checkout.
        </p>
      )}

      <h2 className="mt-10 text-lg font-semibold text-white">Change plan</h2>
      <div className="mt-4">
        <PricingCards variant="billing" currentPlan={plan.id} />
      </div>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon} {label}
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}
