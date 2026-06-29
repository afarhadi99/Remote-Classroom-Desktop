"use client"

import { useState } from "react"
import { Database, Eye, Check, Upload } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"

interface SyncResult {
  adds: { classes: number; students: number }
  updates: { classes: number; students: number }
  removes: { students: number }
  skippedOverCap: number
  details: string[]
}

export function OneRosterPanel() {
  const toast = useToast()
  const [files, setFiles] = useState<{ users?: string; classes?: string; enrollments?: string; orgs?: string }>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<SyncResult | null>(null)

  function pick(kind: "users" | "classes" | "enrollments" | "orgs") {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (!f) return
      const text = await f.text()
      setFiles((prev) => ({ ...prev, [kind]: text }))
      setNames((prev) => ({ ...prev, [kind]: f.name }))
      setPreview(null)
    }
  }

  const ready = files.users && files.classes && files.enrollments

  async function run(dryRun: boolean) {
    if (!ready) return
    setBusy(true)
    try {
      const res = await api<SyncResult>("/api/integrations/oneroster/import", {
        body: { dryRun, users: files.users, classes: files.classes, enrollments: files.enrollments, orgs: files.orgs },
      })
      if (dryRun) {
        setPreview(res)
      } else {
        toast.success(
          "Roster synced",
          `+${res.adds.classes} classes, +${res.adds.students} students, ${res.removes.students} archived.`,
        )
        setPreview(null)
      }
    } catch (e) {
      toast.error("Sync failed", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const Picker = ({ kind, required }: { kind: "users" | "classes" | "enrollments" | "orgs"; required?: boolean }) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition hover:border-foreground/20">
      <span className="text-foreground">
        {kind}.csv {required && <span className="text-destructive">*</span>}
      </span>
      <span className="truncate text-xs text-muted-foreground">{names[kind] ?? "choose…"}</span>
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={pick(kind)} />
    </label>
  )

  return (
    <Card className="mt-4 gap-3 p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Database className="size-4 text-primary" /> OneRoster / SIS roster sync
      </p>
      <p className="-mt-1 text-xs text-muted-foreground">
        Import the standard CSV bundle exported by Clever, ClassLink, PowerSchool, Skyward and most SIS.
        Classes and students sync by <code className="rounded bg-secondary px-1">sourcedId</code> — re-running
        is idempotent, and students dropped from the bundle are de-provisioned.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Picker kind="users" required />
        <Picker kind="classes" required />
        <Picker kind="enrollments" required />
        <Picker kind="orgs" />
      </div>

      {preview && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-semibold text-foreground">Preview (no changes made)</p>
          <p className="mt-1 text-muted-foreground">
            Add <strong className="text-foreground">{preview.adds.classes}</strong> classes,{" "}
            <strong className="text-foreground">{preview.adds.students}</strong> students · update{" "}
            <strong className="text-foreground">{preview.updates.students}</strong> · archive{" "}
            <strong className="text-foreground">{preview.removes.students}</strong>
            {preview.skippedOverCap > 0 && <> · skipped {preview.skippedOverCap} over plan cap</>}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => run(true)} disabled={busy || !ready}>
          {busy ? <Spinner className="size-3.5" /> : <Eye className="size-3.5" />} Preview (dry run)
        </Button>
        <Button variant="ink" size="sm" onClick={() => run(false)} disabled={busy || !ready}>
          {busy ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />} Apply sync
        </Button>
      </div>
    </Card>
  )
}
