"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { Clock, GraduationCap, Radio, ShieldCheck } from "lucide-react"
import { AuthShell } from "@/components/AuthShell"
import { Spinner } from "@/components/brand"
import { Card } from "@/components/ui/card"

interface ParentView {
  studentName: string
  className: string
  joinedAt: string
  currentlyActive: boolean
  usage: { used: number; remaining: number; unlimited: boolean }
}

export default function ParentViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<ParentView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/parent/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || "This link is no longer valid.")
        setData(body)
      })
      .catch((e) => setError((e as Error).message))
  }, [token])

  if (error) {
    return (
      <AuthShell title="Link unavailable" subtitle={error}>
        <p className="text-sm text-muted-foreground">
          Ask the teacher for a fresh link if you still need access.
        </p>
      </AuthShell>
    )
  }

  if (!data) {
    return (
      <AuthShell title="Loading…" subtitle="Fetching this student's summary.">
        <div className="flex justify-center py-4">
          <Spinner className="size-6" />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={data.studentName} subtitle={`${data.className} — read-only summary for guardians.`}>
      <div className="space-y-3">
        <Card className="flex-row items-center gap-3 p-4">
          <span className={`grid size-9 place-items-center rounded-lg ${data.currentlyActive ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
            <Radio className="size-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Right now</p>
            <p className="text-sm font-semibold text-foreground">
              {data.currentlyActive ? "In a desktop session" : "Not currently active"}
            </p>
          </div>
        </Card>

        {!data.usage.unlimited && (
          <Card className="flex-row items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-secondary">
              <Clock className="size-4 text-amber-600" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Desktop time this month</p>
              <p className="text-sm font-semibold text-foreground">
                {data.usage.used} min used · {data.usage.remaining} min left
              </p>
            </div>
          </Card>
        )}

        <Card className="flex-row items-center gap-3 p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-secondary">
            <GraduationCap className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Joined class</p>
            <p className="text-sm font-semibold text-foreground">{new Date(data.joinedAt).toLocaleDateString()}</p>
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" /> This view is intentionally limited to protect student privacy — no
        activity details or desktop content are shown here.
      </p>
    </AuthShell>
  )
}
