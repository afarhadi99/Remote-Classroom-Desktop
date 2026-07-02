"use client"

import { useState } from "react"
import { Timer as TimerIcon, Play, Square } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api, formatRemaining } from "@/lib/client"

export function TimerModal({
  classId,
  endsAt,
  label: currentLabel,
  open,
  onOpenChange,
  onChanged,
}: {
  classId: string
  endsAt: string | null
  label: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [minutes, setMinutes] = useState("10")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)

  const running = endsAt != null && new Date(endsAt).getTime() > Date.now()
  const remainingMs = running ? new Date(endsAt!).getTime() - Date.now() : 0

  async function start() {
    const mins = Math.round(Number(minutes))
    if (!Number.isFinite(mins) || mins < 1 || mins > 180) {
      toast.error("Enter a duration from 1 to 180 minutes")
      return
    }
    setBusy(true)
    try {
      await api(`/api/classes/${classId}/timer`, { method: "POST", body: { minutes: mins, label: label.trim() || null } })
      toast.success("Timer started", "Every student sees a live countdown.")
      onOpenChange(false)
      onChanged()
    } catch (e) {
      toast.error("Could not start timer", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    try {
      await api(`/api/classes/${classId}/timer`, { method: "DELETE" })
      toast.info("Timer canceled")
      onOpenChange(false)
      onChanged()
    } catch (e) {
      toast.error("Could not cancel timer", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <TimerIcon className="size-5 text-primary" /> Class timer
          </DialogTitle>
          <DialogDescription>A shared countdown every student sees live on their screen.</DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-center">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{formatRemaining(remainingMs)}</p>
              {currentLabel && <p className="mt-1 text-sm text-muted-foreground">{currentLabel}</p>}
            </div>
            <Button variant="destructive" className="w-full" onClick={cancel} disabled={busy}>
              {busy ? <Spinner /> : <Square className="size-3.5" />} Cancel timer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="timer-minutes">Duration (minutes)</Label>
              <Input
                id="timer-minutes"
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timer-label">Label (optional)</Label>
              <Input
                id="timer-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Finish the lab exercise"
              />
            </div>
            <Button variant="ink" className="w-full" onClick={start} disabled={busy}>
              {busy ? <Spinner /> : <Play className="size-3.5" />} Start timer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
