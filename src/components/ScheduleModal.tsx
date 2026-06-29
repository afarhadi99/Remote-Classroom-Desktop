"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2, CalendarClock } from "lucide-react"
import { Spinner, OsIcon } from "@/components/brand"
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
import { api, formatDurationLabel } from "@/lib/client"
import type { OsType } from "@/lib/os"

interface Slot {
  id: string
  weekday: number
  startMinute: number
  durationMin: number
  endMinute: number | null
  os: string
  enabled: boolean
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const fmt12 = (m: number) => {
  const h = Math.floor(m / 60)
  const min = m % 60
  const am = h < 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, "0")} ${am ? "AM" : "PM"}`
}

export function ScheduleModal({
  classId,
  maxMinutes,
  open,
  onOpenChange,
}: {
  classId: string
  maxMinutes: number
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [weekday, setWeekday] = useState(1)
  const [time, setTime] = useState("09:00")
  const [duration, setDuration] = useState(Math.min(45, maxMinutes))
  const [endTime, setEndTime] = useState("")
  const [os, setOs] = useState<OsType>("linux")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const { schedules } = await api<{ schedules: Slot[] }>(`/api/classes/${classId}/schedules`)
      setSlots(schedules)
    } catch (e) {
      toast.error("Could not load schedule", (e as Error).message)
    }
  }, [classId, toast])

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function add() {
    setSaving(true)
    try {
      const [h, m] = time.split(":").map(Number)
      let endMinute: number | null = null
      if (endTime) {
        const [eh, em] = endTime.split(":").map(Number)
        endMinute = eh * 60 + em
      }
      await api(`/api/classes/${classId}/schedules`, {
        body: { weekday, startMinute: h * 60 + m, durationMin: Math.min(duration, maxMinutes), endMinute, os },
      })
      toast.success("Slot added")
      load()
    } catch (e) {
      toast.error("Could not add slot", (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/classes/${classId}/schedules?scheduleId=${id}`, { method: "DELETE" })
      load()
    } catch (e) {
      toast.error("Could not remove", (e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <CalendarClock className="size-5 text-primary" /> Class schedule
          </DialogTitle>
          <DialogDescription>
            Desktops boot automatically a couple minutes before each slot. Set an optional bell-end
            time to shut the whole class down at period&apos;s end, even for late booters. Times are in
            the server&apos;s local timezone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {!slots ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Spinner className="size-5" />
            </div>
          ) : slots.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No recurring slots yet.</p>
          ) : (
            slots.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <OsIcon os={s.os} className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{DAYS[s.weekday]}</span>
                <span className="text-muted-foreground">
                  {fmt12(s.startMinute)} · {formatDurationLabel(s.durationMin)}
                  {s.endMinute != null && <span className="text-amber-600"> · bell {fmt12(s.endMinute)}</span>}
                </span>
                <button
                  onClick={() => remove(s.id)}
                  className="ml-auto cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Day</Label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              {DAYS_SHORT.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Start</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Minutes</Label>
            <Input
              type="number"
              min={5}
              max={maxMinutes}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bell end <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">OS</Label>
            <select
              value={os}
              onChange={(e) => setOs(e.target.value as OsType)}
              className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="linux">Linux</option>
              <option value="windows">Windows</option>
            </select>
          </div>
        </div>
        <Button variant="ink" onClick={add} disabled={saving} className="w-fit">
          {saving ? <Spinner /> : <Plus className="size-4" />} Add slot
        </Button>
      </DialogContent>
    </Dialog>
  )
}
