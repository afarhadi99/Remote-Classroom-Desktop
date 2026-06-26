"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, X, Download, CalendarDays } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"

interface Row {
  name: string
  present: boolean
  firstSeen: string | null
}
interface Attendance {
  date: string
  presentCount: number
  total: number
  students: Row[]
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function AttendanceModal({
  classId,
  className,
  open,
  onOpenChange,
}: {
  classId: string
  className: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      try {
        setData(await api<Attendance>(`/api/classes/${classId}/attendance?date=${d}`))
      } catch (e) {
        toast.error("Could not load attendance", (e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [classId, toast],
  )

  useEffect(() => {
    if (open) load(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function exportCsv() {
    if (!data) return
    const rows = [
      ["Student", "Status", "First active"],
      ...data.students.map((s) => [
        s.name,
        s.present ? "Present" : "Absent",
        s.firstSeen ? new Date(s.firstSeen).toLocaleTimeString() : "",
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${className.replace(/[^a-z0-9]+/gi, "-")}-${data.date}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <CalendarDays className="size-5 text-primary" /> Attendance
          </DialogTitle>
          <DialogDescription>
            Marked present automatically when a student starts their desktop.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => {
                setDate(e.target.value)
                load(e.target.value)
              }}
            />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.total === 0}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{data.presentCount}</span> of {data.total} present
            </p>
            <div className="max-h-[45vh] divide-y divide-border overflow-y-auto">
              {data.students.map((s) => (
                <div key={s.name} className="flex items-center gap-3 py-2 text-sm">
                  {s.present ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <X className="size-4 text-muted-foreground/50" />
                  )}
                  <span className="flex-1 text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.present ? `since ${new Date(s.firstSeen!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "absent"}
                  </span>
                </div>
              ))}
              {data.total === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No students in this class yet.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
