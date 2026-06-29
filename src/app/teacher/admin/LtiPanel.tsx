"use client"

import { useCallback, useEffect, useState } from "react"
import { GraduationCap, Plus, Trash2, Check } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/CopyButton"
import { useToast } from "@/components/Toast"

interface Platform {
  id: string
  issuer: string
  clientId: string
  authLoginUrl: string
  jwksUrl: string
  deploymentIds: string[]
}

const FIELDS = [
  ["issuer", "Issuer (platform URL)", "https://canvas.instructure.com"],
  ["clientId", "Client ID", "10000000000001"],
  ["authLoginUrl", "OIDC auth URL", "https://canvas.instructure.com/api/lti/authorize_redirect"],
  ["authTokenUrl", "Token URL", "https://canvas.instructure.com/login/oauth2/token"],
  ["jwksUrl", "Platform JWKS URL", "https://canvas.instructure.com/api/lti/security/jwks"],
  ["deploymentIds", "Deployment ID(s)", "1:abc"],
] as const

export function LtiPanel() {
  const toast = useToast()
  const [platforms, setPlatforms] = useState<Platform[] | null>(null)
  const [origin, setOrigin] = useState("")
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/lti", { cache: "no-store" })
      const d = await res.json()
      setPlatforms(d.platforms ?? [])
    } catch {
      setPlatforms([])
    }
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
    load()
  }, [load])

  async function register() {
    setBusy(true)
    try {
      const res = await fetch("/api/teacher/lti", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Failed")
      toast.success("Platform registered")
      setForm({})
      setCreating(false)
      load()
    } catch (e) {
      toast.error("Could not register", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm("Unregister this LMS platform?")) return
    await fetch(`/api/teacher/lti/${id}`, { method: "DELETE" })
    load()
  }

  const ToolUrl = ({ label, path }: { label: string; path: string }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <code className="flex-1 overflow-x-auto rounded bg-secondary px-2 py-1 font-mono text-foreground">{origin}{path}</code>
      <CopyButton value={`${origin}${path}`} label="" variant="ghost" />
    </div>
  )

  return (
    <Card className="mt-4 gap-3 p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <GraduationCap className="size-4 text-primary" /> LMS integration (LTI 1.3)
      </p>
      <p className="-mt-1 text-xs text-muted-foreground">
        Launch students straight onto a desktop from Canvas, Schoology, Moodle, Blackboard or D2L —
        no join code. Paste these tool URLs into your LMS&apos;s developer-key / external-tool config:
      </p>
      <div className="space-y-1.5 rounded-lg border border-border p-3">
        <ToolUrl label="OIDC login" path="/api/lti/login" />
        <ToolUrl label="Launch / redirect" path="/api/lti/launch" />
        <ToolUrl label="Public JWKS" path="/api/lti/jwks.json" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Registered platforms</p>
        <Button variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="size-3.5" /> Register platform
        </Button>
      </div>

      {creating && (
        <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
          {FIELDS.map(([key, label, ph]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={ph}
                className="h-9 text-sm"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button variant="ink" size="sm" onClick={register} disabled={busy}>
              {busy ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />} Save platform
            </Button>
          </div>
        </div>
      )}

      {!platforms ? (
        <div className="flex justify-center py-4 text-muted-foreground"><Spinner className="size-5" /></div>
      ) : platforms.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">No LMS platforms registered yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {platforms.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.issuer}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  client {p.clientId} · deploy {p.deploymentIds.join(", ")}
                </p>
              </div>
              <button onClick={() => remove(p.id)} className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive" title="Unregister">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
