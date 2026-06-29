"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  School,
  MonitorPlay,
  DollarSign,
  Hand,
  AlertTriangle,
  Gauge,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/Toast"
import { api, formatRemaining } from "@/lib/client"
import { initialsOf } from "@/lib/utils"
import { ApiKeysPanel } from "./ApiKeysPanel"
import { WebhooksPanel } from "./WebhooksPanel"

interface Live {
  machineId: string
  classId: string
  className: string
  studentName: string | null
  os: string
  status: string
  remainingMs: number | null
}
interface Alert {
  studentId: string
  classId: string
  className: string
  name: string
  kind: string | null
  note: string | null
  at: string
}
interface PerClass {
  id: string
  name: string
  studentCount: number
  liveCount: number
  minutes: number
  costCents: number
}
interface AdminData {
  teacher: { name: string; email: string }
  plan: { id: string; name: string }
  totals: { classes: number; students: number; liveDesktops: number; monthMinutes: number; monthCostCents: number }
  guardrails: {
    maxConcurrentDesktops: number | null
    concurrencyUsed: number
    monthlySpendCapCents: number | null
    spentCents: number
  }
  billing: { planStatus: string | null; currentPeriodEnd: string | null }
  live: Live[]
  alerts: Alert[]
  classes: PerClass[]
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function AdminConsole() {
  const toast = useToast()
  const [data, setData] = useState<AdminData | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api<AdminData>("/api/teacher/admin"))
    } catch (e) {
      toast.error("Could not load console", (e as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center px-5 py-20 text-muted-foreground">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { totals, guardrails, alerts, live, classes } = data

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> All classes
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl text-foreground">Admin console</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A live, organization-wide view of every class, desktop and dollar — for {data.plan.name} plan.
        </p>
      </header>

      {/* top metrics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<School className="size-4 text-primary" />} label="Classes" value={String(totals.classes)} />
        <Metric icon={<Users className="size-4 text-primary" />} label="Students" value={String(totals.students)} />
        <Metric
          icon={<MonitorPlay className="size-4 text-emerald-600" />}
          label="Live desktops"
          value={String(totals.liveDesktops)}
        />
        <Metric
          icon={<DollarSign className="size-4 text-amber-600" />}
          label="This month"
          value={usd(totals.monthCostCents)}
          hint={`${totals.monthMinutes} desktop-min`}
        />
      </div>

      {/* alerts across all classes */}
      {alerts.length > 0 && (
        <Card className="mt-4 gap-3 border-amber-300 bg-amber-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Hand className="size-4" /> {alerts.length} student{alerts.length === 1 ? "" : "s"} need help across your classes
          </p>
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <Link
                key={a.studentId}
                href={`/teacher/class/${a.classId}`}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-card px-3 py-2 text-sm transition hover:border-amber-300"
              >
                {a.kind === "report" ? (
                  <AlertTriangle className="size-4 text-amber-600" />
                ) : (
                  <Hand className="size-4 text-amber-600" />
                )}
                <span className="font-medium text-foreground">{a.name}</span>
                <span className="text-muted-foreground">· {a.className}</span>
                {a.note && <span className="truncate text-muted-foreground">“{a.note}”</span>}
                <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* live desktops */}
        <Card className="gap-0 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MonitorPlay className="size-4 text-primary" /> Live desktops
          </p>
          {live.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No desktops are running right now.</p>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-border">
              {live.map((m) => (
                <Link
                  key={m.machineId}
                  href={`/teacher/class/${m.classId}`}
                  className="flex items-center gap-3 py-2.5 transition hover:opacity-80"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
                      {initialsOf(m.studentName ?? "?") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.studentName ?? "Student"}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.className}</p>
                  </div>
                  <OsIcon os={m.os} className="size-3.5 text-muted-foreground" />
                  <StatusBadge status={m.status} />
                  {m.remainingMs != null && (
                    <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                      {formatRemaining(m.remainingMs)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* guardrails + SSO */}
        <div className="flex flex-col gap-4">
          <Card className="gap-3 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gauge className="size-4 text-primary" /> Guardrails
            </p>
            <GuardBar
              label="Concurrent desktops"
              used={guardrails.concurrencyUsed}
              cap={guardrails.maxConcurrentDesktops}
              format={(n) => String(n)}
            />
            <GuardBar
              label="Monthly spend"
              used={guardrails.spentCents}
              cap={guardrails.monthlySpendCapCents}
              format={usd}
            />
            <Button asChild variant="outline" size="sm" className="mt-1 self-start">
              <Link href="/teacher/billing">Adjust limits</Link>
            </Button>
          </Card>

          <Card className="gap-2 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" /> Single sign-on (SSO)
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Let staff and students sign in with their school accounts via your district&apos;s identity
              provider — Google Workspace, Microsoft Entra, Clever, or any SAML/OIDC IdP. SSO and automated
              roster provisioning are configured per district.
            </p>
            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Available for district plans — contact us to enable
            </span>
          </Card>
        </div>
      </div>

      {/* per-class breakdown */}
      <Card className="mt-4 gap-0 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <School className="size-4 text-primary" /> Classes
        </p>
        {classes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No classes yet.{" "}
            <Link href="/teacher" className="font-medium text-primary hover:underline">Create one →</Link>
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Class</th>
                  <th className="py-2 pr-3 text-right font-medium">Students</th>
                  <th className="py-2 pr-3 text-right font-medium">Live</th>
                  <th className="py-2 pr-3 text-right font-medium">Minutes</th>
                  <th className="py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link href={`/teacher/class/${c.id}`} className="font-medium text-foreground hover:text-primary">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{c.studentCount}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {c.liveCount > 0 ? (
                        <span className="font-medium text-emerald-600">{c.liveCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{c.minutes}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{usd(c.costCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ApiKeysPanel />
      <WebhooksPanel />
    </main>
  )
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-secondary">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-2xl leading-tight text-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  )
}

function GuardBar({
  label,
  used,
  cap,
  format,
}: {
  label: string
  used: number
  cap: number | null
  format: (n: number) => string
}) {
  const pct = cap && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  const over = cap != null && used >= cap
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? "font-semibold text-destructive" : "tabular-nums text-foreground"}>
          {format(used)} {cap != null ? `/ ${format(cap)}` : "· no limit"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={over ? "h-full bg-destructive" : "h-full bg-primary"}
          style={{ width: cap != null ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  )
}
