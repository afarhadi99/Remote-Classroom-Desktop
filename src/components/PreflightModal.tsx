"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Rocket } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { cn } from "@/lib/utils"

interface Check {
  key: string
  level: "ok" | "warn" | "fail"
  message: string
}

export function PreflightModal({ classId, open, onOpenChange }: { classId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const toast = useToast()
  const [data, setData] = useState<{ ready: boolean; checks: Check[] } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api<{ ready: boolean; checks: Check[] }>(`/api/classes/${classId}/preflight`))
    } catch (e) {
      toast.error("Could not run preflight", (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [classId, toast])

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const icon = (level: Check["level"]) =>
    level === "ok" ? <CheckCircle2 className="size-4 text-emerald-600" /> : level === "warn" ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-destructive" />

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Rocket className="size-5 text-primary" /> Class readiness
          </DialogTitle>
          <DialogDescription>A quick pre-flight check so nothing surprises you when the bell rings.</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Spinner className="size-5" /></div>
        ) : (
          <div className="space-y-4">
            <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium", data.ready ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-destructive/30 bg-destructive/10 text-destructive")}>
              {data.ready ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {data.ready ? "Ready to teach — no blockers." : "Not ready — resolve the blockers below."}
            </div>
            <div className="space-y-2">
              {data.checks.map((c) => (
                <div key={c.key} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0">{icon(c.level)}</span>
                  <span className="text-foreground/90">{c.message}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Re-check</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
