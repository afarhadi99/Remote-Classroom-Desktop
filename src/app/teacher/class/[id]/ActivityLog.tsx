"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Rocket,
  Power,
  AlertTriangle,
  Lock,
  Unlock,
  Download,
  MonitorCheck,
  Clock,
  Coins,
  ScrollText,
  ShieldCheck,
} from "lucide-react"
import { Spinner } from "@/components/brand"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { cn } from "@/lib/utils"

interface ClassEvent {
  id: string
  type: string
  message: string
  actorRole: string | null
  studentName: string | null
  createdAt: string
}

const ICONS: Record<string, { icon: typeof Rocket; cls: string }> = {
  boot: { icon: Rocket, cls: "text-primary" },
  running: { icon: MonitorCheck, cls: "text-emerald-600" },
  stopped: { icon: Power, cls: "text-muted-foreground" },
  expired: { icon: Clock, cls: "text-amber-600" },
  error: { icon: AlertTriangle, cls: "text-destructive" },
  lock: { icon: Lock, cls: "text-amber-600" },
  unlock: { icon: Unlock, cls: "text-emerald-600" },
  download: { icon: Download, cls: "text-sky-600" },
  provision_all: { icon: Rocket, cls: "text-primary" },
  shutdown_all: { icon: Power, cls: "text-muted-foreground" },
  safeguard: { icon: AlertTriangle, cls: "text-destructive" },
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function ActivityLog({
  classId,
  usage,
}: {
  classId: string
  usage: { totalMinutes: number; estimatedCostCents: number }
}) {
  const toast = useToast()
  const [events, setEvents] = useState<ClassEvent[] | null>(null)

  const load = useCallback(async () => {
    try {
      const { events } = await api<{ events: ClassEvent[] }>(`/api/classes/${classId}/events`)
      setEvents(events)
    } catch (e) {
      toast.error("Could not load activity", (e as Error).message)
    }
  }, [classId, toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="mt-4 space-y-4">
      {/* usage summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex-row items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-lg bg-secondary">
            <Clock className="size-5 text-amber-600" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Desktop time this month</p>
            <p className="text-lg font-semibold text-foreground">{usage.totalMinutes} min</p>
          </div>
        </Card>
        <Card className="flex-row items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-lg bg-secondary">
            <Coins className="size-5 text-emerald-600" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Estimated cost this month</p>
            <p className="text-lg font-semibold text-foreground">
              ${(usage.estimatedCostCents / 100).toFixed(2)}
            </p>
          </div>
        </Card>
      </div>

      {/* event timeline */}
      <Card className="gap-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium text-muted-foreground">
          <ScrollText className="size-4 text-primary" /> Activity log
          <a
            href={`/api/classes/${classId}/events/export`}
            download
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-foreground/20"
          >
            <Download className="size-3.5" /> Export CSV
          </a>
          <a
            href={`/api/classes/${classId}/audit/manifest`}
            download={`audit-manifest-${classId}.json`}
            title="Download a signed integrity digest of this log for compliance records"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-foreground/20"
          >
            <ShieldCheck className="size-3.5" /> Signed manifest
          </a>
        </div>
        {!events ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No activity yet. Boots, shutdowns, locks and downloads will show up here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => {
              const meta = ICONS[e.type] ?? { icon: ScrollText, cls: "text-muted-foreground" }
              const Icon = meta.icon
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon className={cn("size-4 shrink-0", meta.cls)} />
                  <span className="flex-1 text-foreground">{e.message}</span>
                  {e.actorRole && e.actorRole !== "system" && (
                    <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground sm:inline">
                      {e.actorRole}
                    </span>
                  )}
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {ago(e.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
