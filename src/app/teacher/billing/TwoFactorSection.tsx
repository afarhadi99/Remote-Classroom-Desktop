"use client"

import { useState } from "react"
import { KeyRound, ShieldCheck, ShieldOff, Copy } from "lucide-react"
import { Spinner } from "@/components/brand"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/client"

export function TwoFactorSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const toast = useToast()
  const [setupOpen, setSetupOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableOpen, setDisableOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function startSetup() {
    setBusy(true)
    try {
      const res = await api<{ secret: string; otpauthUrl: string }>("/api/teacher/totp/setup", { method: "POST" })
      setSecret(res.secret)
      setOtpauthUrl(res.otpauthUrl)
      setSetupOpen(true)
    } catch (e) {
      toast.error("Could not start setup", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    setBusy(true)
    try {
      const res = await api<{ backupCodes: string[] }>("/api/teacher/totp/enable", { method: "POST", body: { code } })
      setBackupCodes(res.backupCodes)
      setSetupOpen(false)
      setCode("")
      onChanged()
    } catch (e) {
      toast.error("Could not enable 2FA", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await api("/api/teacher/totp/disable", { method: "POST", body: { password: disablePassword } })
      toast.info("Two-factor authentication disabled")
      setDisableOpen(false)
      setDisablePassword("")
      onChanged()
    } catch (e) {
      toast.error("Could not disable 2FA", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (backupCodes) {
    return (
      <Card className="mt-6 gap-0 p-6">
        <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <KeyRound className="size-5 text-primary" /> Save your backup codes
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Each code works once if you lose access to your authenticator app. Store them somewhere safe — they
          won&apos;t be shown again.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-4 font-mono text-sm sm:grid-cols-4">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button
          variant="ink"
          className="mt-4 w-fit"
          onClick={() => {
            navigator.clipboard?.writeText(backupCodes.join("\n")).catch(() => {})
            toast.success("Copied to clipboard")
          }}
        >
          <Copy className="size-4" /> Copy codes
        </Button>
        <Button variant="outline" className="mt-2 w-fit" onClick={() => setBackupCodes(null)}>
          Done
        </Button>
      </Card>
    )
  }

  return (
    <Card className="mt-6 gap-0 p-6">
      <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ShieldCheck className="size-5 text-primary" /> Two-factor authentication
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {enabled
          ? "Enabled — logins require a code from your authenticator app."
          : "Add a second step at login using an authenticator app (Google Authenticator, Authy, 1Password)."}
      </p>

      {!enabled && !setupOpen && (
        <Button variant="ink" className="mt-4 w-fit" onClick={startSetup} disabled={busy}>
          {busy ? <Spinner /> : <ShieldCheck className="size-4" />} Set up 2FA
        </Button>
      )}

      {!enabled && setupOpen && secret && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            In your authenticator app, add an account and enter this key manually:
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-sm tracking-widest text-foreground">
              {secret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(secret).catch(() => {})
                toast.success("Copied")
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          {otpauthUrl && (
            <p className="break-all text-[11px] text-muted-foreground">{otpauthUrl}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="totp-code">Enter the 6-digit code it shows</Label>
            <Input id="totp-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="max-w-40" />
          </div>
          <div className="flex gap-2">
            <Button variant="ink" onClick={confirmEnable} disabled={busy || code.length < 6}>
              {busy ? <Spinner /> : <ShieldCheck className="size-4" />} Confirm &amp; enable
            </Button>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {enabled && !disableOpen && (
        <Button variant="outline" className="mt-4 w-fit text-destructive hover:text-destructive" onClick={() => setDisableOpen(true)}>
          <ShieldOff className="size-4" /> Disable 2FA
        </Button>
      )}

      {enabled && disableOpen && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="disable-pw">Confirm your password</Label>
            <Input
              id="disable-pw"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="max-w-64"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={disable} disabled={busy || !disablePassword}>
              {busy ? <Spinner /> : <ShieldOff className="size-4" />} Disable 2FA
            </Button>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
