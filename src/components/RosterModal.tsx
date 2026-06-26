"use client"

import { useState } from "react"
import { UserPlus, Upload } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"

// Split a pasted block (one-per-line or comma/tab/semicolon-separated CSV) into names.
function parseNames(text: string): string[] {
  return text
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function RosterModal({
  classId,
  open,
  onOpenChange,
  onAdded,
}: {
  classId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  const names = parseNames(text)

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const content = await file.text()
    // CSV: keep the first column of each row; skip an obvious "name" header.
    const rows = content.split(/\r?\n/).map((line) => line.split(",")[0]?.trim() ?? "")
    const cleaned = rows.filter((r, i) => r && !(i === 0 && /^name$/i.test(r)))
    setText((prev) => (prev ? prev + "\n" : "") + cleaned.join("\n"))
  }

  async function submit() {
    if (names.length === 0) return
    setBusy(true)
    try {
      const res = await api<{
        added: number
        skippedExisting: number
        skippedFull: number
        cap: number | null
      }>(`/api/classes/${classId}/roster`, { body: { names } })

      const bits: string[] = []
      if (res.skippedExisting) bits.push(`${res.skippedExisting} already in class`)
      if (res.skippedFull) bits.push(`${res.skippedFull} over the ${res.cap}-student cap`)

      if (res.added > 0) {
        toast.success(
          `Added ${res.added} student${res.added === 1 ? "" : "s"}`,
          bits.length ? `Skipped ${bits.join(", ")}.` : "They can join with the class code.",
        )
      } else {
        toast.info("No new students added", bits.length ? `Skipped ${bits.join(", ")}.` : undefined)
      }

      setText("")
      onOpenChange(false)
      onAdded()
    } catch (e) {
      toast.error("Could not import roster", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <UserPlus className="size-5 text-primary" /> Add students
          </DialogTitle>
          <DialogDescription>
            Paste a class list — one name per line, or a CSV. Students still join with the class
            code; this just sets up their seats and persistent files ahead of time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="roster">Student names</Label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Upload className="size-3.5" /> Import CSV
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={loadFile} />
            </label>
          </div>
          <textarea
            id="roster"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={"Ada Lovelace\nAlan Turing\nGrace Hopper"}
            className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">
            {names.length > 0
              ? `${names.length} name${names.length === 1 ? "" : "s"} ready to add.`
              : "Re-importing the same names is safe — duplicates are skipped."}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ink" onClick={submit} disabled={busy || names.length === 0}>
            {busy ? <Spinner className="size-3.5" /> : <UserPlus className="size-3.5" />}
            Add {names.length || ""} student{names.length === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
