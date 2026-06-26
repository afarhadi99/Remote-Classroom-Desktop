"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Sparkles, Loader2 } from "lucide-react"
import { PLANS, formatPrice, type Plan } from "@/lib/plans"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/Toast"
import { cn } from "@/lib/utils"

export function PricingCards({
  variant = "public",
  currentPlan,
}: {
  variant?: "public" | "billing"
  currentPlan?: "free" | "pro"
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function upgrade() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Checkout failed")
      window.location.href = data.url
    } catch (e) {
      toast.error("Could not start checkout", (e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      <PlanCard
        plan={PLANS.free}
        highlight={false}
        current={variant === "billing" && currentPlan === "free"}
        cta={
          variant === "public" ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/teacher/signup">Start free</Link>
            </Button>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              {currentPlan === "free" ? "Your current plan" : "Included"}
            </Button>
          )
        }
      />
      <PlanCard
        plan={PLANS.pro}
        highlight
        current={variant === "billing" && currentPlan === "pro"}
        cta={
          variant === "public" ? (
            <Button asChild variant="ink" className="w-full">
              <Link href="/teacher/signup">
                <Sparkles className="size-4" /> Get started with Pro
              </Link>
            </Button>
          ) : currentPlan === "pro" ? (
            <Button variant="ink" className="w-full" disabled>
              <Check className="size-4" /> You’re on Pro
            </Button>
          ) : (
            <Button variant="ink" className="w-full" onClick={upgrade} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Upgrade to Pro
            </Button>
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
  plan: Plan
  highlight: boolean
  current: boolean
  cta: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6",
        highlight ? "border-ink bg-card shadow-lg" : "border-border bg-card/60",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-6">
          <Badge variant="gold" className="gap-1 px-2.5 py-1 shadow-sm">
            <Sparkles className="size-3" /> Most popular
          </Badge>
        </span>
      )}
      {current && (
        <span className="absolute -top-3 right-6">
          <Badge variant="success" className="px-2.5 py-1">
            Current
          </Badge>
        </span>
      )}
      <h3 className="font-display text-2xl text-foreground">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {formatPrice(plan.priceMonthly)}
        </span>
        <span className="mb-1.5 text-sm text-muted-foreground">
          {plan.priceMonthly ? "/ month" : "forever"}
        </span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <Check className={cn("mt-0.5 size-4 shrink-0", highlight ? "text-primary" : "text-emerald-600")} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
      {plan.id === "pro" && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          *Windows requires the Windows class enabled on your Daytona organization.
        </p>
      )}
    </div>
  )
}
