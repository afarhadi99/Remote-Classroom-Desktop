"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { AuthShell } from "@/components/AuthShell"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/client"

export default function TeacherLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [challenge, setChallenge] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ requiresTotp?: boolean; challenge?: string }>("/api/auth/teacher/login", {
        body: { email, password },
      })
      if (res.requiresTotp && res.challenge) {
        setChallenge(res.challenge)
        setLoading(false)
        return
      }
      router.push("/teacher")
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (!challenge) return
    setLoading(true)
    setError(null)
    try {
      await api("/api/auth/teacher/totp/verify-login", { body: { challenge, code } })
      router.push("/teacher")
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  if (challenge) {
    return (
      <AuthShell
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app, or a backup code."
      >
        <form onSubmit={submitCode} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" /> Code
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoFocus
              required
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="ink" size="lg" className="w-full" disabled={loading}>
            {loading && <Spinner />} Verify
          </Button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null)
              setCode("")
              setError(null)
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Back to login
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage your classes and desktops."
      footer={
        <>
          New here?{" "}
          <Link href="/teacher/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="ink" size="lg" className="w-full" disabled={loading}>
          {loading && <Spinner />} Log in
        </Button>
      </form>
    </AuthShell>
  )
}
