"use client"

import { useState } from "react"
import { ListChecks, Save } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"

export function AgendaModal({
  classId,
  initialItems,
  initialStep,
  open,
  onOpenChange,
  onChanged,
}: {
  classId: string
  initialItems: string[]
  initialStep: number | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState("")
  const [step, setStep] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [seeded, setSeeded] = useState(false)

  // Seed from the live agenda each time the modal opens.
  if (open && !seeded) {
    setSeeded(true)
    setText(initialItems.join("\n"))
    setStep(initialStep)
  }
  if (!open && seeded) setSeeded(false)

  const items = text.split("\n").map((s) => s.trim()).filter(Boolean)

  async function save() {
    setBusy(true)
    try {
      await api(`/api/classes/${classId}/agenda`, { method: "POST", body: { items, step: step != null && step < items.length ? step : null } })
      toast.success(items.length ? "Agenda updated" : "Agenda cleared", items.length ? "Students see it on their screens." : undefined)
      onOpenChange(false)
      onChanged()
    } catch (e) {
      toast.error("Could not save agenda", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <ListChecks className="size-5 text-primary" /> Lesson agenda
          </DialogTitle>
          <DialogDescription>One step per line. Mark where the class is now so students can follow along.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="agenda">Steps</Label>
          <textarea
            id="agenda"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"Warm-up: open last lesson's file\nMini-lesson: functions\nLab: build a calculator\nExit ticket"}
            className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="step">Current step</Label>
            <select
              id="step"
              value={step ?? ""}
              onChange={(e) => setStep(e.target.value === "" ? null : Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">— none —</option>
              {items.map((it, i) => (
                <option key={i} value={i}>{i + 1}. {it.slice(0, 60)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ink" onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />} {items.length ? "Save agenda" : "Clear agenda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
