"use client"

import { useState } from "react"
import { Megaphone, Send, Trash2 } from "lucide-react"
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

export function AnnounceModal({
  classId,
  current,
  open,
  onOpenChange,
  onChanged,
}: {
  classId: string
  current: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  // Seed the textarea with the live announcement whenever the dialog opens.
  const [seededFor, setSeededFor] = useState<boolean | null>(null)
  if (open && seededFor !== open) {
    setSeededFor(open)
    setText(current ?? "")
  }
  if (!open && seededFor) setSeededFor(null)

  async function send(clear = false) {
    setBusy(true)
    try {
      await api(`/api/classes/${classId}/announcement`, {
        method: "POST",
        body: { text: clear ? null : text.trim() || null },
      })
      toast.success(clear ? "Announcement cleared" : "Announcement sent", clear ? undefined : "Every student sees it now.")
      onOpenChange(false)
      onChanged()
    } catch (e) {
      toast.error("Could not update announcement", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Megaphone className="size-5 text-primary" /> Class announcement
          </DialogTitle>
          <DialogDescription>
            Shows as a banner on every student&apos;s screen — re-readable, unlike a spoken instruction.
            Great for &ldquo;open chapter 4&rdquo; or &ldquo;submit to the Turn-in folder.&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ann">Message</Label>
          <textarea
            id="ann"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Open Chapter 4 and start the warm-up."
            className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">{text.length}/280</p>
        </div>

        <div className="flex justify-between gap-2">
          {current ? (
            <Button variant="ghost" onClick={() => send(true)} disabled={busy} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" /> Clear
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ink" onClick={() => send(false)} disabled={busy || !text.trim()}>
            {busy ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />} Send to class
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
