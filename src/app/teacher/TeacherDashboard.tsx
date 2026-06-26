"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Trash2, Users, MonitorPlay, ArrowRight, Sparkles, Lock } from "lucide-react"
import { Spinner, OsIcon } from "@/components/brand"
import { CopyButton } from "@/components/CopyButton"
import { OsPicker, DurationPicker } from "@/components/Pickers"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { api, formatDurationLabel } from "@/lib/client"
import type { OsType } from "@/lib/os"

interface ClassSummary {
  id: string
  name: string
  joinCode: string
  defaultOs: OsType
  defaultDurationMin: number
  allowStudentBoot: boolean
  studentCount: number
  activeMachines: number
  createdAt: string
}

interface Account {
  plan: { id: "free" | "pro"; name: string; maxClasses: number; maxClassesUnlimited: boolean; maxSessionMinutes: number }
  classCount: number
}

export function TeacherDashboard({ teacherName }: { teacherName: string }) {
  const toast = useToast()
  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    try {
      const [{ classes }, acct] = await Promise.all([
        api<{ classes: ClassSummary[] }>("/api/classes"),
        api<Account>("/api/teacher/account"),
      ])
      setClasses(classes)
      setAccount(acct)
    } catch (err) {
      toast.error("Could not load classes", (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const plan = account?.plan
  const atClassLimit = !!plan && !plan.maxClassesUnlimited && classes.length >= plan.maxClasses

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-foreground">
              Welcome, {teacherName.split(" ")[0]}
            </h1>
            {plan && (
              <Link href="/teacher/billing">
                <Badge variant={plan.id === "pro" ? "gold" : "outline"} className="px-2.5 py-1">
                  {plan.id === "pro" && <Sparkles className="size-3" />}
                  {plan.name} plan
                </Badge>
              </Link>
            )}
          </div>
          <p className="mt-1.5 text-muted-foreground">
            Create a class, share the code, and give every student a cloud desktop.
          </p>
        </div>
        {atClassLimit ? (
          <Button asChild variant="ink">
            <Link href="/teacher/billing">
              <Sparkles className="size-4" /> Upgrade for more classes
            </Link>
          </Button>
        ) : (
          <Button variant="ink" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> New class
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-20 flex justify-center text-muted-foreground">
          <Spinner className="size-6" />
        </div>
      ) : classes.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} onDeleted={load} />
          ))}
        </div>
      )}

      <CreateClassModal
        open={showCreate}
        onOpenChange={setShowCreate}
        maxMinutes={plan?.maxSessionMinutes ?? 45}
        onCreated={load}
      />
    </main>
  )
}

function ClassCard({ c, onDeleted }: { c: ClassSummary; onDeleted: () => void }) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    if (!confirm(`Delete "${c.name}"? This shuts down all its desktops and removes students.`)) return
    setDeleting(true)
    try {
      await api(`/api/classes/${c.id}`, { method: "DELETE" })
      toast.success("Class deleted")
      onDeleted()
    } catch (err) {
      toast.error("Could not delete", (err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <Card className="group gap-0 py-0 transition hover:shadow-md">
      <div className="flex items-start justify-between p-5 pb-3">
        <Link href={`/teacher/class/${c.id}`} className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground group-hover:text-primary">
            {c.name}
          </h3>
        </Link>
        <button
          onClick={remove}
          disabled={deleting}
          className="-mr-1 -mt-1 cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          title="Delete class"
        >
          {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2 px-5">
        <code className="rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-sm font-medium tracking-wider text-primary">
          {c.joinCode}
        </code>
        <CopyButton value={c.joinCode} label="Code" variant="ghost" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 px-5">
        <Badge variant="secondary" className="font-normal">
          <OsIcon os={c.defaultOs} className="size-3.5" />
          {c.defaultOs === "windows" ? "Windows" : "Linux"}
        </Badge>
        <Badge variant="secondary" className="font-normal">
          {formatDurationLabel(c.defaultDurationMin)}
        </Badge>
        <Badge variant="secondary" className="font-normal">
          <Users className="size-3.5" /> {c.studentCount}
        </Badge>
        {c.activeMachines > 0 && (
          <Badge variant="success">
            <MonitorPlay className="size-3.5" /> {c.activeMachines} live
          </Badge>
        )}
      </div>

      <Link
        href={`/teacher/class/${c.id}`}
        className="mt-5 flex items-center gap-1.5 border-t border-border px-5 py-3 text-sm font-medium text-primary transition hover:bg-accent"
      >
        Manage class <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-ink text-background">
        <Plus className="size-7" />
      </div>
      <h3 className="font-display mt-5 text-2xl text-foreground">Create your first class</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Name it, pick an operating system and a time limit, and we&apos;ll generate a join code for
        your students.
      </p>
      <Button variant="ink" className="mt-6" onClick={onCreate}>
        <Plus className="size-4" /> New class
      </Button>
    </div>
  )
}

function CreateClassModal({
  open,
  onOpenChange,
  onCreated,
  maxMinutes,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
  maxMinutes: number
}) {
  const toast = useToast()
  const [name, setName] = useState("")
  const [os, setOs] = useState<OsType>("linux")
  const [duration, setDuration] = useState(Math.min(60, maxMinutes))
  const [allowStudentBoot, setAllowStudentBoot] = useState(true)
  const [saving, setSaving] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/classes", {
        body: { name, defaultOs: os, defaultDurationMin: duration, allowStudentBoot },
      })
      toast.success("Class created", "Share the join code with your students.")
      onOpenChange(false)
      setName("")
      onCreated()
    } catch (err) {
      toast.error("Could not create class", (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New class</DialogTitle>
          <DialogDescription>Students will join this class with a code.</DialogDescription>
        </DialogHeader>

        <form onSubmit={create} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Class name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 3 — Intro to Linux"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Operating system</Label>
            <OsPicker value={os} onChange={setOs} />
          </div>

          <div className="space-y-2">
            <Label>Time limit per desktop</Label>
            <DurationPicker value={duration} onChange={setDuration} maxMinutes={maxMinutes} />
            {maxMinutes < 120 && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> Longer sessions are available on Pro.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3.5">
            <span className="text-sm">
              <span className="font-medium text-foreground">Let students boot their own desktop</span>
              <span className="block text-xs text-muted-foreground">If off, only you can start their machines.</span>
            </span>
            <Switch checked={allowStudentBoot} onCheckedChange={setAllowStudentBoot} />
          </label>

          <Button type="submit" variant="ink" size="lg" className="w-full" disabled={saving || !name}>
            {saving && <Spinner />} Create class
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
