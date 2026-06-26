"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CreditCard, Sparkles, Layers, Clock, Users, Loader2 } from "lucide-react"
import { Spinner } from "@/components/brand"
import { PricingCards } from "@/components/Pricing"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, formatDurationLabel } from "@/lib/client"

interface Account {
  teacher: { name: string; email: string }
  plan: {
    id: "free" | "pro"
    name: string
    maxClasses: number
    maxClassesUnlimited: boolean
    maxStudentsPerClass: number
    maxStudentsUnlimited: boolean
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
      setAccount(await api<Account>("/api/teacher/account"))
    } catch (e) {
      toast.error("Could not load billing", (e as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
    const status = new URLSearchParams(window.location.search).get("status")
    if (status === "success") {
      toast.success("Welcome to Pro! 🎉", "Your plan is being activated.")
      ;[1500, 4000, 8000].forEach((ms) => setTimeout(load, ms))
      window.history.replaceState({}, "", "/teacher/billing")
    } else if (status === "canceled") {
      toast.info("Checkout canceled", "No changes were made to your plan.")
      window.history.replaceState({}, "", "/teacher/billing")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function manage() {
    setPortalLoading(true)
    try {
      const { url } = await api<{ url: string }>("/api/billing/portal", { method: "POST" })
      window.location.href = url
    } catch (e) {
      toast.error("Could not open billing portal", (e as Error).message)
      setPortalLoading(false)
    }
  }

  if (!account) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 justify-center px-5 py-20 text-muted-foreground">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { plan } = account
  const renews = account.currentPeriodEnd ? new Date(account.currentPeriodEnd) : null

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to classes
      </Link>

      <h1 className="font-display mt-4 text-3xl text-foreground">Plan &amp; billing</h1>

      <Card className="mt-5 gap-0 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-ink text-background">
              {plan.id === "pro" ? <Sparkles className="size-5" /> : <Layers className="size-5" />}
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">{plan.name} plan</p>
              <p className="text-sm text-muted-foreground">
                {account.planStatus
                  ? `Status: ${account.planStatus}${renews ? ` · renews ${renews.toLocaleDateString()}` : ""}`
                  : "No subscription — you’re on the free tier."}
              </p>
            </div>
          </div>
          {account.hasBillingAccount && (
            <Button variant="outline" onClick={manage} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Manage billing
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat icon={<Layers className="size-4 text-primary" />} label="Classes" value={`${account.classCount} / ${plan.maxClassesUnlimited ? "∞" : plan.maxClasses}`} />
          <Stat icon={<Users className="size-4 text-emerald-600" />} label="Students / class" value={plan.maxStudentsUnlimited ? "∞" : String(plan.maxStudentsPerClass)} />
          <Stat icon={<Clock className="size-4 text-amber-600" />} label="Max session" value={formatDurationLabel(plan.maxSessionMinutes)} />
          <Stat icon={<Clock className="size-4 text-sky-600" />} label="Per student / mo" value={plan.monthlyUnlimited ? "Unlimited" : `${plan.monthlyMinutesPerStudent} min`} />
        </div>
      </Card>

      {!account.billingEnabled && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Upgrades aren’t configured on this server yet (no Stripe key). The free tier is fully
          functional; add <code className="font-mono text-xs">STRIPE_SECRET_KEY</code> to enable Pro checkout.
        </p>
      )}

      <h2 className="font-display mt-10 text-2xl text-foreground">Change plan</h2>
      <div className="mt-4">
        <PricingCards variant="billing" currentPlan={plan.id} />
      </div>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
