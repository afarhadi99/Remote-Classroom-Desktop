"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ListChecks, Send, Plus, X, BarChart3 } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { cn } from "@/lib/utils"

interface Results {
  poll: { id: string; prompt: string; type: string; options: string[]; closed: boolean }
  answered: number
  totalStudents: number
  tally: number[]
  answers: { name: string; text: string }[]
}

export function PollModal({ classId, open, onOpenChange }: { classId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const toast = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  // compose state
  const [prompt, setPrompt] = useState("")
  const [type, setType] = useState<"mcq" | "short">("mcq")
  const [options, setOptions] = useState(["", ""])
  const [busy, setBusy] = useState(false)

  const loadActive = useCallback(async () => {
    const { activePoll } = await api<{ activePoll: { id: string } | null }>(`/api/classes/${classId}/polls`)
    setActiveId(activePoll?.id ?? null)
    return activePoll?.id ?? null
  }, [classId])

  const loadResults = useCallback(
    async (pollId: string) => {
      try {
        setResults(await api<Results>(`/api/classes/${classId}/polls/${pollId}`))
      } catch (e) {
        toast.error("Could not load results", (e as Error).message)
      }
    },
    [classId, toast],
  )

  // On open, find any live poll; poll its results every 3s while open.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!open) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    let id: string | null = null
    setLoading(true)
    loadActive().then((pid) => {
      id = pid
      if (pid) loadResults(pid)
      setLoading(false)
    })
    timer.current = setInterval(() => {
      if (id) loadResults(id)
    }, 3000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId])

  async function create() {
    if (!prompt.trim()) return
    setBusy(true)
    try {
      const body = type === "mcq" ? { prompt, type, options: options.map((o) => o.trim()).filter(Boolean) } : { prompt, type }
      const { poll } = await api<{ poll: { id: string } }>(`/api/classes/${classId}/polls`, { body })
      setActiveId(poll.id)
      setPrompt("")
      setOptions(["", ""])
      loadResults(poll.id)
      toast.success("Poll is live", "Students see it on their screens now.")
    } catch (e) {
      toast.error("Could not start poll", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    if (!activeId) return
    setBusy(true)
    try {
      await api(`/api/classes/${classId}/polls/${activeId}`, { method: "POST" })
      toast.success("Poll closed")
      await loadResults(activeId)
    } catch (e) {
      toast.error("Could not close", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startNew() {
    setActiveId(null)
    setResults(null)
  }

  const showResults = activeId && results
  const maxTally = results ? Math.max(1, ...results.tally) : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <ListChecks className="size-5 text-primary" /> Live poll
          </DialogTitle>
          <DialogDescription>Push a question to every student&apos;s screen and watch answers arrive in real time.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Spinner className="size-5" /></div>
        ) : showResults ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-medium text-foreground">{results.poll.prompt}</p>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                {results.answered} / {results.totalStudents} answered
              </span>
            </div>
            {results.poll.type === "mcq" ? (
              <div className="space-y-2">
                {results.poll.options.map((opt, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-foreground">{opt}</span><span className="tabular-nums text-muted-foreground">{results.tally[i] ?? 0}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${((results.tally[i] ?? 0) / maxTally) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {results.answers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No answers yet.</p>
                ) : (
                  results.answers.map((a, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{a.name}: </span>
                      <span className="text-muted-foreground">{a.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={startNew}><Plus className="size-3.5" /> New poll</Button>
              {!results.poll.closed ? (
                <Button variant="ink" onClick={close} disabled={busy}>{busy ? <Spinner className="size-3.5" /> : <BarChart3 className="size-3.5" />} Close poll</Button>
              ) : (
                <span className="self-center text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prompt">Question</Label>
              <Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What did you find hardest today?" autoFocus />
            </div>
            <div className="flex gap-2">
              {(["mcq", "short"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={cn("flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition", type === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/20")}>
                  {t === "mcq" ? "Multiple choice" : "Short answer"}
                </button>
              ))}
            </div>
            {type === "mcq" && (
              <div className="space-y-2">
                <Label>Options</Label>
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={o} onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
                    {options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))}><X className="size-4" /></Button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <Button variant="outline" size="sm" onClick={() => setOptions((arr) => [...arr, ""])}><Plus className="size-3.5" /> Add option</Button>
                )}
              </div>
            )}
            <Button variant="ink" className="w-full" onClick={create} disabled={busy || !prompt.trim()}>
              {busy ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />} Launch poll
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
