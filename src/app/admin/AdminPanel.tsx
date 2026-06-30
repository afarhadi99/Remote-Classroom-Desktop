"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, Users, School, MonitorPlay, DollarSign, ShieldCheck, LogOut,
  Search, Sparkles, Power, Settings2, RefreshCw,
} from "lucide-react"
import { Brand, Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api, formatRemaining } from "@/lib/client"
import { initialsOf, cn } from "@/lib/utils"

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

interface Overview {
  totals: { teachers: number; students: number; classes: number; activeDesktops: number; monthMinutes: number; monthCostCents: number }
  subscriptions: { free: number; pro: number; mrrCents: number }
  recentTeachers: { id: string; name: string; email: string; plan: string; createdAt: string }[]
}
interface TeacherRow {
  id: string; name: string; email: string; plan: string; planLabel: string; planStatus: string | null
  currentPeriodEnd: string | null; hasStripe: boolean; classCount: number; studentCount: number
  liveDesktops: number; monthMinutes: number; monthCostCents: number
  maxConcurrentDesktops: number | null; monthlySpendCapCents: number | null; createdAt: string
}
interface Desktop {
  id: string; os: string; status: string; studentName: string | null; className: string
  teacherName: string; teacherEmail: string; remainingMs: number | null; runMinutes: number; costCents: number
}

type Tab = "overview" | "schools" | "desktops"

export function AdminPanel({ adminName }: { adminName: string }) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("overview")

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <Brand href="/admin" />
            <Badge variant="gold" className="gap-1"><ShieldCheck className="size-3" /> Platform admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{adminName}</span>
            <Button onClick={signOut} variant="outline" size="sm"><LogOut className="size-3.5" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <h1 className="font-display text-3xl text-foreground">Platform console</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Oversee every school, subscription and running desktop.</p>

        <div className="mt-5 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
          {([["overview", "Overview", Building2], ["schools", "Schools & billing", School], ["desktops", "Desktops", MonitorPlay]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                tab === k ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "overview" && <OverviewTab toast={toast} />}
          {tab === "schools" && <SchoolsTab toast={toast} />}
          {tab === "desktops" && <DesktopsTab toast={toast} />}
        </div>
      </main>
    </div>
  )
}

type Toast = ReturnType<typeof useToast>

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

function OverviewTab({ toast }: { toast: Toast }) {
  const [d, setD] = useState<Overview | null>(null)
  const load = useCallback(async () => {
    try { setD(await api<Overview>("/api/admin/overview")) } catch (e) { toast.error("Could not load", (e as Error).message) }
  }, [toast])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  if (!d) return <div className="flex justify-center py-16 text-muted-foreground"><Spinner className="size-6" /></div>

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Users className="size-4 text-primary" />} label="Teachers" value={String(d.totals.teachers)} />
        <Metric icon={<Users className="size-4 text-primary" />} label="Students" value={String(d.totals.students)} />
        <Metric icon={<School className="size-4 text-primary" />} label="Classes" value={String(d.totals.classes)} />
        <Metric icon={<MonitorPlay className="size-4 text-emerald-600" />} label="Live desktops" value={String(d.totals.activeDesktops)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="gap-3 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><DollarSign className="size-4 text-amber-600" /> Subscriptions</p>
          <div className="flex items-end gap-6">
            <div><p className="font-display text-3xl text-foreground">{usd(d.subscriptions.mrrCents)}</p><p className="text-xs text-muted-foreground">Est. MRR</p></div>
            <div><p className="font-display text-2xl text-foreground">{d.subscriptions.pro}</p><p className="text-xs text-muted-foreground">Pro</p></div>
            <div><p className="font-display text-2xl text-foreground">{d.subscriptions.free}</p><p className="text-xs text-muted-foreground">Free</p></div>
          </div>
          <p className="text-xs text-muted-foreground">{usd(d.totals.monthCostCents)} estimated desktop cost this month ({d.totals.monthMinutes} min).</p>
        </Card>
        <Card className="gap-2 p-5">
          <p className="text-sm font-medium text-muted-foreground">Newest schools</p>
          <div className="divide-y divide-border">
            {d.recentTeachers.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2 text-sm">
                <Avatar className="size-6"><AvatarFallback className="bg-secondary text-[10px] font-semibold">{initialsOf(t.name) || "?"}</AvatarFallback></Avatar>
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="truncate text-xs text-muted-foreground">{t.email}</span>
                <Badge variant={t.plan === "pro" ? "gold" : "outline"} className="ml-auto">{t.plan}</Badge>
              </div>
            ))}
            {d.recentTeachers.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No teachers yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

function SchoolsTab({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<TeacherRow[] | null>(null)
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<TeacherRow | null>(null)

  const load = useCallback(async (query: string) => {
    try { setRows((await api<{ teachers: TeacherRow[] }>(`/api/admin/teachers${query ? `?q=${encodeURIComponent(query)}` : ""}`)).teachers) }
    catch (e) { toast.error("Could not load schools", (e as Error).message) }
  }, [toast])
  useEffect(() => { load("") }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} placeholder="Search teachers by name or email" className="pl-8" />
        </div>
        <Button variant="outline" size="sm" onClick={() => load(q)}><RefreshCw className="size-3.5" /> Refresh</Button>
      </div>

      {!rows ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Spinner className="size-6" /></div>
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">School / teacher</th>
                <th className="px-3 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 text-right font-medium">Classes</th>
                <th className="px-3 py-2.5 text-right font-medium">Students</th>
                <th className="px-3 py-2.5 text-right font-medium">Live</th>
                <th className="px-3 py-2.5 text-right font-medium">This month</th>
                <th className="px-4 py-2.5 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={t.plan === "pro" ? "gold" : "outline"}>{t.plan === "pro" && <Sparkles className="size-3" />}{t.planLabel}</Badge>
                    {t.planStatus && <span className="ml-1 text-[11px] text-muted-foreground">{t.planStatus}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{t.classCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{t.studentCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.liveDesktops > 0 ? <span className="font-medium text-emerald-600">{t.liveDesktops}</span> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{usd(t.monthCostCents)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(t)}><Settings2 className="size-3.5" /> Manage</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No teachers found.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <ManageTeacherModal teacher={editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={() => { setEditing(null); load(q) }} toast={toast} />
    </div>
  )
}

function ManageTeacherModal({ teacher, onOpenChange, onSaved, toast }: { teacher: TeacherRow | null; onOpenChange: (v: boolean) => void; onSaved: () => void; toast: Toast }) {
  const [plan, setPlan] = useState<"free" | "pro">("free")
  const [status, setStatus] = useState("")
  const [maxConcurrent, setMaxConcurrent] = useState("")
  const [spendCap, setSpendCap] = useState("")
  const [busy, setBusy] = useState(false)
  const [seeded, setSeeded] = useState<string | null>(null)

  if (teacher && seeded !== teacher.id) {
    setSeeded(teacher.id)
    setPlan(teacher.plan === "pro" ? "pro" : "free")
    setStatus(teacher.planStatus ?? "")
    setMaxConcurrent(teacher.maxConcurrentDesktops?.toString() ?? "")
    setSpendCap(teacher.monthlySpendCapCents != null ? (teacher.monthlySpendCapCents / 100).toString() : "")
  }
  if (!teacher && seeded) setSeeded(null)

  async function save() {
    if (!teacher) return
    setBusy(true)
    try {
      await api(`/api/admin/teachers/${teacher.id}`, {
        method: "PATCH",
        body: {
          plan,
          planStatus: status.trim() || null,
          maxConcurrentDesktops: maxConcurrent.trim() === "" ? null : Math.max(0, parseInt(maxConcurrent, 10) || 0),
          monthlySpendCapCents: spendCap.trim() === "" ? null : Math.max(0, Math.round(parseFloat(spendCap) * 100) || 0),
        },
      })
      toast.success("Subscription updated", `${teacher.name} is now on ${plan}.`)
      onSaved()
    } catch (e) {
      toast.error("Could not update", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function stopAll() {
    if (!teacher || !confirm(`Shut down every running desktop owned by ${teacher.name}?`)) return
    setBusy(true)
    try {
      const r = await api<{ stopped: number }>(`/api/admin/teachers/${teacher.id}`, { method: "DELETE" })
      toast.success(`Shut down ${r.stopped} desktop${r.stopped === 1 ? "" : "s"}`)
      onSaved()
    } catch (e) {
      toast.error("Could not shut down", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!teacher} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{teacher?.name}</DialogTitle>
          <DialogDescription>{teacher?.email} · override subscription & cost guardrails (bypasses Stripe).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <div className="flex gap-2">
              {(["free", "pro"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPlan(p)}
                  className={cn("flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium capitalize transition", plan === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/20")}>
                  {p === "pro" ? "Pro (comp)" : "Free"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Plan status</Label>
            <Input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="active / comp / past_due (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mc">Max concurrent</Label>
              <Input id="mc" type="number" min={0} value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} placeholder="none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc">Spend cap ($/mo)</Label>
              <Input id="sc" type="number" min={0} value={spendCap} onChange={(e) => setSpendCap(e.target.value)} placeholder="none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={stopAll} disabled={busy} className="text-destructive hover:bg-destructive/10">
            <Power className="size-3.5" /> Stop all desktops
          </Button>
          <Button variant="ink" onClick={save} disabled={busy}>{busy ? <Spinner className="size-3.5" /> : null} Save override</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DesktopsTab({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<Desktop[] | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try { setRows((await api<{ desktops: Desktop[] }>("/api/admin/desktops")).desktops) }
    catch (e) { toast.error("Could not load desktops", (e as Error).message) }
  }, [toast])
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [load])

  async function stop(id: string) {
    setBusy((b) => ({ ...b, [id]: true }))
    try { await api(`/api/admin/desktops/${id}/stop`, { method: "POST" }); toast.success("Desktop shut down"); load() }
    catch (e) { toast.error("Could not stop", (e as Error).message); setBusy((b) => ({ ...b, [id]: false })) }
  }

  if (!rows) return <div className="flex justify-center py-16 text-muted-foreground"><Spinner className="size-6" /></div>
  if (rows.length === 0) return <Card className="items-center py-16 text-center text-muted-foreground"><MonitorPlay className="size-7 text-muted-foreground/60" /><p className="mt-2">No desktops running across the platform.</p></Card>

  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">User</th>
            <th className="px-3 py-2.5 font-medium">Class / teacher</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 text-right font-medium">Time left</th>
            <th className="px-3 py-2.5 text-right font-medium">Cost</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><OsIcon os={m.os} className="size-3.5 text-muted-foreground" /><span className="font-medium text-foreground">{m.studentName ?? "Student"}</span></span></td>
              <td className="px-3 py-2.5"><p className="text-foreground">{m.className}</p><p className="text-xs text-muted-foreground">{m.teacherName} · {m.teacherEmail}</p></td>
              <td className="px-3 py-2.5"><StatusBadge status={m.status} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.remainingMs != null ? formatRemaining(m.remainingMs) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{usd(m.costCents)}</td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => stop(m.id)} disabled={busy[m.id]}>
                  {busy[m.id] ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />} Stop
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
