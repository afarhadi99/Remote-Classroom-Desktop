"use client"

import { useCallback, useEffect, useState } from "react"
import { Webhook, Plus, Trash2, Check, RefreshCw, ChevronDown } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/CopyButton"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { cn } from "@/lib/utils"

interface Endpoint {
  id: string
  url: string
  secret: string
  events: string[]
  enabled: boolean
  createdAt: string
}
interface Delivery {
  id: string
  eventType: string
  status: string
  attempts: number
  responseCode: number | null
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  delivered: "text-emerald-600",
  pending: "text-amber-600",
  failed: "text-amber-600",
  dead: "text-destructive",
}

export function WebhooksPanel() {
  const toast = useToast()
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null)
  const [eventList, setEventList] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])

  const load = useCallback(async () => {
    try {
      const d = await api<{ endpoints: Endpoint[]; events: string[] }>("/api/teacher/webhooks")
      setEndpoints(d.endpoints)
      setEventList(d.events)
    } catch (e) {
      toast.error("Could not load webhooks", (e as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    if (!url.trim() || events.size === 0) return
    setBusy(true)
    try {
      await api("/api/teacher/webhooks", { body: { url: url.trim(), events: [...events] } })
      toast.success("Webhook added", "Copy its signing secret to verify payloads.")
      setUrl("")
      setEvents(new Set())
      setCreating(false)
      load()
    } catch (e) {
      toast.error("Could not add webhook", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this webhook endpoint and its delivery history?")) return
    try {
      await api(`/api/teacher/webhooks/${id}`, { method: "DELETE" })
      if (openId === id) setOpenId(null)
      load()
    } catch (e) {
      toast.error("Could not delete", (e as Error).message)
    }
  }

  async function openDeliveries(id: string) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    try {
      const d = await api<{ deliveries: Delivery[] }>(`/api/teacher/webhooks/${id}`)
      setDeliveries(d.deliveries)
    } catch (e) {
      toast.error("Could not load deliveries", (e as Error).message)
    }
  }

  async function resend(deliveryId: string, endpointId: string) {
    try {
      await api("/api/teacher/webhooks/resend", { body: { deliveryId } })
      toast.info("Re-queued", "Retrying delivery now.")
      // Give the immediate attempt a beat, then refresh the list.
      await new Promise((r) => setTimeout(r, 800))
      const d = await api<{ deliveries: Delivery[] }>(`/api/teacher/webhooks/${endpointId}`)
      setDeliveries(d.deliveries)
    } catch (e) {
      toast.error("Could not resend", (e as Error).message)
    }
  }

  return (
    <Card className="mt-4 gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Webhook className="size-4 text-primary" /> Webhooks
        </p>
        <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="size-3.5" /> Add endpoint
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Push class events to Slack, Teams, Zapier, a SIEM, or any URL. Each POST is HMAC-signed
        (<code className="rounded bg-secondary px-1">X-RCD-Signature</code>) and retried with backoff.
      </p>

      {creating && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="wurl">Endpoint URL</Label>
            <Input id="wurl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/rcd" />
          </div>
          <div className="space-y-1.5">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-1.5">
              {["*", ...eventList].map((ev) => {
                const on = events.has(ev)
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() =>
                      setEvents((prev) => {
                        const n = new Set(prev)
                        if (n.has(ev)) n.delete(ev)
                        else n.add(ev)
                        return n
                      })
                    }
                    className={cn(
                      "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/20",
                    )}
                  >
                    {ev}
                  </button>
                )
              })}
            </div>
          </div>
          <Button variant="ink" size="sm" onClick={create} disabled={busy || !url.trim() || events.size === 0}>
            {busy ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />} Add
          </Button>
        </div>
      )}

      {!endpoints ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Spinner className="size-5" /></div>
      ) : endpoints.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No webhook endpoints yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {endpoints.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{e.url}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{e.events.join(", ")}</p>
                </div>
                <CopyButton value={e.secret} label="Secret" variant="ghost" />
                <button onClick={() => openDeliveries(e.id)} className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-accent" title="Recent deliveries">
                  <ChevronDown className={cn("size-4 transition", openId === e.id && "rotate-180")} />
                </button>
                <button onClick={() => remove(e.id)} className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" title="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>

              {openId === e.id && (
                <div className="mt-2 border-t border-border pt-2">
                  {deliveries.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">No deliveries yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {deliveries.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-foreground">{d.eventType}</span>
                          <span className={cn("font-semibold", STATUS_COLOR[d.status] ?? "text-muted-foreground")}>{d.status}</span>
                          <span className="text-muted-foreground">
                            {d.attempts} attempt{d.attempts === 1 ? "" : "s"}{d.responseCode ? ` · ${d.responseCode}` : ""}
                          </span>
                          {(d.status === "failed" || d.status === "dead") && (
                            <button onClick={() => resend(d.id, e.id)} className="ml-auto inline-flex cursor-pointer items-center gap-1 text-primary hover:underline">
                              <RefreshCw className="size-3" /> resend
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
