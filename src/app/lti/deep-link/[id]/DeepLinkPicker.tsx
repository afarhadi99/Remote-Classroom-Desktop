"use client"

import { useEffect, useState } from "react"
import { Plus, Link2, GraduationCap } from "lucide-react"
import { Brand, Spinner, OsIcon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import type { OsType } from "@/lib/os"

interface ClassSummary { id: string; name: string; joinCode: string; defaultOs: OsType }

export function DeepLinkPicker({ sessionId, valid }: { sessionId: string; valid: boolean }) {
  const toast = useToast()
  const [classes, setClasses] = useState<ClassSummary[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!valid) return
    api<{ classes: ClassSummary[] }>("/api/classes").then((d) => setClasses(d.classes)).catch(() => setClasses([]))
  }, [valid])

  // Build a self-submitting form that POSTs the signed JWT back to the LMS return URL.
  function postBack(returnUrl: string, jwt: string) {
    const f = document.createElement("form")
    f.method = "POST"
    f.action = returnUrl
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "JWT"
    input.value = jwt
    f.appendChild(input)
    document.body.appendChild(f)
    f.submit()
  }

  async function choose(classId: string) {
    setBusy(true)
    try {
      const { jwt, returnUrl, className } = await api<{ jwt: string; returnUrl: string; className: string }>(
        `/api/lti/deep-link/${sessionId}/select`,
        { body: { classId } },
      )
      toast.success(`Added "${className}" to your course`, "Sending you back to the LMS…")
      postBack(returnUrl, jwt)
    } catch (e) {
      toast.error("Could not create the link", (e as Error).message)
      setBusy(false)
    }
  }

  async function createAndChoose() {
    const name = window.prompt("Name this class:")
    if (!name?.trim()) return
    setBusy(true)
    try {
      const { classroom } = await api<{ classroom: { id: string } }>("/api/classes", { body: { name: name.trim() } })
      await choose(classroom.id)
    } catch (e) {
      toast.error("Could not create class", (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-7">
      <div className="flex items-center gap-2">
        <Brand />
      </div>
      {!valid ? (
        <div className="py-6 text-center">
          <p className="font-display text-xl text-foreground">This link setup expired</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Re-open the activity from your LMS to try again.</p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl text-foreground">
              <Link2 className="size-5 text-primary" /> Add a desktop activity
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the class to embed in your course. Students who open it land straight on their desktop.
            </p>
          </div>

          {!classes ? (
            <div className="flex justify-center py-8 text-muted-foreground"><Spinner className="size-5" /></div>
          ) : (
            <div className="space-y-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() => choose(c.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition hover:border-primary/40 disabled:opacity-50"
                >
                  <OsIcon os={c.defaultOs} className="size-4 text-muted-foreground" />
                  <span className="flex-1 font-medium text-foreground">{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.joinCode}</span>
                </button>
              ))}
              <Button variant="outline" className="w-full" onClick={createAndChoose} disabled={busy}>
                {busy ? <Spinner className="size-4" /> : <Plus className="size-4" />} Create a new class
              </Button>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GraduationCap className="size-3.5" /> Linked via LTI Advantage Deep Linking.
          </p>
        </>
      )}
    </Card>
  )
}
