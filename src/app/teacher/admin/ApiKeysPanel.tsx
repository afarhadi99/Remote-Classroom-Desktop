"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Plus, Trash2, Check, ShieldAlert, BookOpen } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/CopyButton"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { cn } from "@/lib/utils"

interface ApiKey {
  id: string
  name: string
  scopes: string[]
  prefix: string
  last4: string
  revoked: boolean
  lastUsedAt: string | null
  createdAt: string
}

export function ApiKeysPanel() {
  const toast = useToast()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [scopeList, setScopeList] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api<{ keys: ApiKey[]; scopes: string[] }>("/api/teacher/api-keys")
      setKeys(d.keys)
      setScopeList(d.scopes)
    } catch (e) {
      toast.error("Could not load API keys", (e as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function mint() {
    if (!name.trim() || scopes.size === 0) return
    setBusy(true)
    try {
      const res = await api<{ secret: string }>("/api/teacher/api-keys", {
        body: { name: name.trim(), scopes: [...scopes] },
      })
      setNewSecret(res.secret)
      setName("")
      setScopes(new Set())
      setCreating(false)
      load()
    } catch (e) {
      toast.error("Could not create key", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? Any integration using it will stop working immediately.")) return
    try {
      await api(`/api/teacher/api-keys/${id}`, { method: "DELETE" })
      load()
    } catch (e) {
      toast.error("Could not revoke", (e as Error).message)
    }
  }

  return (
    <Card className="mt-4 gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <KeyRound className="size-4 text-primary" /> API keys & integrations
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
              <BookOpen className="size-3.5" /> API docs
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="size-3.5" /> New key
          </Button>
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Drive classes, rosters and desktops programmatically — point your SIS, MDM, or scripts at{" "}
        <code className="rounded bg-secondary px-1">/api/v1</code> with{" "}
        <code className="rounded bg-secondary px-1">Authorization: Bearer rcd_sk_…</code>.
      </p>

      {newSecret && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
            <ShieldAlert className="size-4" /> Copy your key now — it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-emerald-200 bg-card px-2.5 py-1.5 font-mono text-xs text-foreground">
              {newSecret}
            </code>
            <CopyButton value={newSecret} label="Copy" />
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-2 cursor-pointer text-xs text-emerald-700 underline">
            Done
          </button>
        </div>
      )}

      {creating && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="kname">Key name</Label>
            <Input id="kname" value={name} onChange={(e) => setName(e.target.value)} placeholder="PowerSchool sync" />
          </div>
          <div className="space-y-1.5">
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-2">
              {scopeList.map((s) => {
                const on = scopes.has(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setScopes((prev) => {
                        const n = new Set(prev)
                        if (n.has(s)) n.delete(s)
                        else n.add(s)
                        return n
                      })
                    }
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/20",
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <Button variant="ink" size="sm" onClick={mint} disabled={busy || !name.trim() || scopes.size === 0}>
            {busy ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />} Create key
          </Button>
        </div>
      )}

      {!keys ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Spinner className="size-5" />
        </div>
      ) : keys.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {k.name}
                  {k.revoked && (
                    <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      revoked
                    </span>
                  )}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {k.prefix}…{k.last4} · {k.scopes.join(", ")}
                  {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · never used"}
                </p>
              </div>
              {!k.revoked && (
                <button
                  onClick={() => revoke(k.id)}
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  title="Revoke"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
