"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Plus, Send, Check } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface Submission { studentId: string; studentName: string; status: string; score: number | null; scoreMax: number | null }
interface Assignment { id: string; title: string; submissions: Submission[] }

export function AssignmentsModal({
  classId,
  students,
  open,
  onOpenChange,
}: {
  classId: string
  students: { id: string; name: string }[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({})

  const load = useCallback(async () => {
    try {
      const d = await api<{ assignments: Assignment[] }>(`/api/classes/${classId}/assignments`)
      setAssignments(d.assignments)
      setSelected((cur) => cur ?? d.assignments[0]?.id ?? null)
    } catch (e) {
      toast.error("Could not load assignments", (e as Error).message)
    }
  }, [classId, toast])

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function create() {
    if (!title.trim()) return
    setBusy(true)
    try {
      const res = await api<{ id: string }>(`/api/classes/${classId}/assignments`, { body: { title: title.trim() } })
      setTitle("")
      await load()
      setSelected(res.id)
    } catch (e) {
      toast.error("Could not create", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handBack(studentId: string) {
    const g = grades[studentId] || { score: "", feedback: "" }
    setBusy(true)
    try {
      const res = await api<{ wroteToDesktop: boolean }>(`/api/classes/${classId}/assignments/${selected}/handback`, {
        method: "POST",
        body: { studentId, score: g.score === "" ? null : Number(g.score), scoreMax: 100, feedback: g.feedback || undefined },
      })
      toast.success(
        "Returned to student",
        res.wroteToDesktop ? "Saved to their My-Files/Returned folder." : "Score recorded — they'll get the file next boot.",
      )
      load()
    } catch (e) {
      toast.error("Could not hand back", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const current = assignments?.find((a) => a.id === selected)
  const statusOf = (sid: string) => current?.submissions.find((s) => s.studentId === sid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <ClipboardList className="size-5 text-primary" /> Assignments & hand-back
          </DialogTitle>
          <DialogDescription>
            Return graded work and feedback straight to a student&apos;s desktop. Scores are recorded and
            ready for LTI grade passback to your LMS.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          {assignments && assignments.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Assignment</Label>
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                className="h-10 rounded-md border border-input bg-card px-2 text-sm"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">New assignment</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lab 3 — Pendulums" className="h-10" />
          </div>
          <Button variant="outline" onClick={create} disabled={busy || !title.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>

        {!assignments ? (
          <div className="flex justify-center py-8 text-muted-foreground"><Spinner className="size-5" /></div>
        ) : !current ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Create an assignment to start grading.</p>
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {students.map((s) => {
              const sub = statusOf(s.id)
              const g = grades[s.id] || { score: "", feedback: "" }
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5">
                  <span className="w-32 shrink-0 truncate text-sm font-medium text-foreground">{s.name}</span>
                  <Input
                    value={g.score}
                    onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...g, score: e.target.value } }))}
                    placeholder="score"
                    type="number"
                    className="h-9 w-20"
                  />
                  <Input
                    value={g.feedback}
                    onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...g, feedback: e.target.value } }))}
                    placeholder="feedback…"
                    className="h-9 flex-1"
                  />
                  {sub?.status === "graded" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <Check className="size-3.5" /> {sub.score ?? "✓"}{sub.scoreMax ? `/${sub.scoreMax}` : ""}
                    </span>
                  ) : null}
                  <Button variant="ink" size="sm" onClick={() => handBack(s.id)} disabled={busy}>
                    <Send className="size-3.5" /> Hand back
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
