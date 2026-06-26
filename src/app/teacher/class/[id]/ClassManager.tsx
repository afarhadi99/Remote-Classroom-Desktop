"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Power,
  PlayCircle,
  Users,
  Rocket,
  Share2,
  Settings2,
  Monitor,
  AlertTriangle,
  Sparkles,
  LayoutGrid,
  List,
  FolderOpen,
  Lock,
  Unlock,
  ScrollText,
  FileUp,
  Inbox,
  CalendarDays,
  CalendarClock,
} from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { CopyButton } from "@/components/CopyButton"
import { OsPicker, DurationPicker } from "@/components/Pickers"
import { DesktopViewer } from "@/components/DesktopViewer"
import { MonitorWall } from "./MonitorWall"
import { ActivityLog } from "./ActivityLog"
import { FilesModal } from "@/components/FilesModal"
import { CollectModal } from "@/components/CollectModal"
import { AttendanceModal } from "@/components/AttendanceModal"
import { ScheduleModal } from "@/components/ScheduleModal"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { api, formatRemaining, formatDurationLabel } from "@/lib/client"
import { initialsOf, cn } from "@/lib/utils"
import type { OsType } from "@/lib/os"

interface SMachine {
  id: string
  studentId: string | null
  studentName: string | null
  os: string
  status: string
  previewUrl: string | null
  errorMessage: string | null
  durationMin: number
  expiresAt: string | null
  remainingMs: number | null
}
interface SStudent {
  id: string
  name: string
  joinedAt: string
  machine: SMachine | null
  usage?: { used: number; remaining: number; unlimited: boolean }
}
interface SClassroom {
  id: string
  name: string
  joinCode: string
  defaultOs: OsType
  defaultDurationMin: number
  allowStudentBoot: boolean
  idleTimeoutMin: number
  locked: boolean
}
interface PlanInfo {
  id: "free" | "pro"
  name: string
  maxSessionMinutes: number
  maxStudentsPerClass: number
  maxStudentsUnlimited: boolean
  monthlyMinutesPerStudent: number
  monthlyUnlimited: boolean
}
interface ClassData {
  classroom: SClassroom
  plan: PlanInfo
  students: SStudent[]
  machines: SMachine[]
  usageSummary: { totalMinutes: number; estimatedCostCents: number }
}

const ACTIVE = ["PROVISIONING", "RUNNING"]

export function ClassManager({ classId }: { classId: string }) {
  const toast = useToast()
  const [data, setData] = useState<ClassData | null>(null)
  const [os, setOs] = useState<OsType>("linux")
  const [duration, setDuration] = useState(60)
  const [idleTimeout, setIdleTimeout] = useState(20)
  const [settingsTouched, setSettingsTouched] = useState(false)
  const [bootingAll, setBootingAll] = useState(false)
  const [stoppingAll, setStoppingAll] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"students" | "wall" | "activity">("students")
  const [filesMachine, setFilesMachine] = useState<{ id: string; name: string | null } | null>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const [handoutBusy, setHandoutBusy] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  const load = useCallback(async () => {
    try {
      const d = await api<ClassData>(`/api/classes/${classId}`)
      setData(d)
      if (!initialized.current) {
        setOs(d.classroom.defaultOs)
        setDuration(Math.min(d.classroom.defaultDurationMin, d.plan.maxSessionMinutes))
        setIdleTimeout(d.classroom.idleTimeoutMin)
        initialized.current = true
      }
    } catch (err) {
      toast.error("Could not load class", (err as Error).message)
    }
  }, [classId, toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  async function saveSettings() {
    setSavingSettings(true)
    try {
      await api(`/api/classes/${classId}`, {
        method: "PATCH",
        body: { defaultOs: os, defaultDurationMin: duration, idleTimeoutMin: idleTimeout },
      })
      setSettingsTouched(false)
      toast.success("Settings saved")
      load()
    } catch (err) {
      toast.error("Could not save", (err as Error).message)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleHandoutFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setHandoutBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/classes/${classId}/handout`, { method: "POST", body: fd })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Hand-out failed")
      toast.success(
        `Sent "${d.fileName}" to ${d.delivered} desktop${d.delivered === 1 ? "" : "s"}`,
        d.notRunning
          ? `${d.notRunning} student${d.notRunning === 1 ? " isn't" : "s aren't"} running a desktop yet.`
          : "Saved to their My-Files/Handouts folder.",
      )
      load()
    } catch (err) {
      toast.error("Could not hand out file", (err as Error).message)
    } finally {
      setHandoutBusy(false)
    }
  }

  async function toggleLock(locked: boolean) {
    setLockBusy(true)
    try {
      await api(`/api/classes/${classId}/lock`, { method: "POST", body: { locked } })
      toast[locked ? "info" : "success"](locked ? "Screens locked" : "Screens unlocked", locked ? "Students see an “Eyes on me” overlay." : "Students can use their desktops again.")
      load()
    } catch (e) {
      toast.error("Could not change lock", (e as Error).message)
    } finally {
      setLockBusy(false)
    }
  }

  async function bootAll() {
    setBootingAll(true)
    try {
      await api(`/api/classes/${classId}`, {
        method: "PATCH",
        body: { defaultOs: os, defaultDurationMin: duration, idleTimeoutMin: idleTimeout },
      })
      const res = await api<{ booted: number }>(`/api/classes/${classId}/provision`, { body: { os, durationMin: duration } })
      toast.success(`Booting ${res.booted} desktop${res.booted === 1 ? "" : "s"}`, "This takes a few seconds per machine.")
      setSettingsTouched(false)
      load()
    } catch (err) {
      toast.error("Could not boot desktops", (err as Error).message)
    } finally {
      setBootingAll(false)
    }
  }

  async function stopAll() {
    if (!confirm("Shut down every running desktop in this class?")) return
    setStoppingAll(true)
    try {
      const res = await api<{ stopped: number }>(`/api/classes/${classId}/stop-all`, { method: "POST" })
      toast.success(`Shut down ${res.stopped} desktop${res.stopped === 1 ? "" : "s"}`)
      setSelectedId(null)
      load()
    } catch (err) {
      toast.error("Could not shut down", (err as Error).message)
    } finally {
      setStoppingAll(false)
    }
  }

  async function bootStudent(studentId: string) {
    setBusy((b) => ({ ...b, [studentId]: true }))
    try {
      await api(`/api/students/${studentId}/boot`, { body: { os, durationMin: duration } })
      load()
    } catch (err) {
      toast.error("Could not boot", (err as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [studentId]: false }))
    }
  }

  async function stopMachine(machineId: string, studentId: string) {
    setBusy((b) => ({ ...b, [studentId]: true }))
    try {
      await api(`/api/machines/${machineId}/stop`, { method: "POST" })
      if (selectedId === machineId) setSelectedId(null)
      load()
    } catch (err) {
      toast.error("Could not stop", (err as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [studentId]: false }))
    }
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center px-5 py-20 text-muted-foreground">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { classroom, students, plan } = data
  const activeCount = students.filter((s) => s.machine && ACTIVE.includes(s.machine.status)).length
  const selectedMachine =
    selectedId != null ? students.map((s) => s.machine).find((m) => m && m.id === selectedId) ?? null : null
  const studentCapLabel = plan.maxStudentsUnlimited ? null : `${students.length} / ${plan.maxStudentsPerClass}`
  const nearStudentCap = !plan.maxStudentsUnlimited && students.length >= plan.maxStudentsPerClass

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> All classes
      </Link>

      {selectedMachine && selectedMachine.status === "RUNNING" && selectedMachine.previewUrl ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl text-foreground">
              Watching {selectedMachine.studentName}&apos;s desktop
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilesMachine({ id: selectedMachine.id, name: selectedMachine.studentName })
                }
              >
                <FolderOpen className="size-3.5" /> Browse files
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="size-3.5" /> Back to class
              </Button>
            </div>
          </div>
          <DesktopViewer
            machine={selectedMachine}
            watchMachineId={selectedMachine.id}
            onStop={() => stopMachine(selectedMachine.id, selectedMachine.studentId!)}
            stopping={busy[selectedMachine.studentId!]}
          />
        </div>
      ) : (
        <>
          <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-foreground">{classroom.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> {students.length} student{students.length === 1 ? "" : "s"}
                  {studentCapLabel && <span className="text-muted-foreground/70">· {studentCapLabel}</span>}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="size-4" /> {activeCount} live
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={classroom.locked ? "ink" : "outline"}
                size="sm"
                onClick={() => toggleLock(!classroom.locked)}
                disabled={lockBusy}
              >
                {lockBusy ? (
                  <Spinner className="size-3.5" />
                ) : classroom.locked ? (
                  <Unlock className="size-3.5" />
                ) : (
                  <Lock className="size-3.5" />
                )}
                {classroom.locked ? "Unlock screens" : "Lock screens"}
              </Button>
              <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
              <button
                onClick={() => setView("students")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  view === "students" ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-3.5" /> Students
              </button>
              <button
                onClick={() => setView("wall")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  view === "wall" ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" /> Monitor wall
                {activeCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-semibold text-emerald-700">
                    {activeCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setView("activity")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  view === "activity" ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ScrollText className="size-3.5" /> Activity
              </button>
              </div>
            </div>
          </header>

          {view === "wall" ? (
            <MonitorWall classId={classId} />
          ) : view === "activity" ? (
            <ActivityLog classId={classId} usage={data.usageSummary} />
          ) : (
          <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            {/* join code */}
            <Card className="justify-between gap-0 p-6">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Share2 className="size-4 text-primary" /> Class join code
                </p>
                <p className="font-display mt-4 text-4xl tracking-[0.1em] text-foreground">{classroom.joinCode}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Students go to the home page → “Join a class” → enter this code and their name.
                </p>
                {nearStudentCap && (
                  <p className="mt-2 text-xs text-amber-600">
                    Class is full ({plan.maxStudentsPerClass} students).{" "}
                    <Link href="/teacher/billing" className="font-medium underline">Upgrade</Link> for more.
                  </p>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <CopyButton value={classroom.joinCode} label="Copy code" />
                <CopyButton value={`Join our class on Remote Classroom. Code: ${classroom.joinCode}`} label="Copy invite" variant="ghost" />
              </div>
            </Card>

            {/* settings */}
            <Card className="gap-0 p-6">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings2 className="size-4 text-primary" /> Desktop settings
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operating system</p>
                  <OsPicker value={os} onChange={(v) => { setOs(v); setSettingsTouched(true) }} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time limit</p>
                  <DurationPicker value={duration} maxMinutes={plan.maxSessionMinutes} onChange={(v) => { setDuration(v); setSettingsTouched(true) }} />
                  <p className="text-xs text-muted-foreground">
                    Auto-shutdown after {formatDurationLabel(duration)}; warnings at 5 / 1 / 0.5 min.
                    {plan.id === "free" && (
                      <>
                        {" "}
                        <Link href="/teacher/billing" className="font-medium text-primary hover:underline">Upgrade →</Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Idle auto-stop
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 10, label: "10 min" },
                    { v: 20, label: "20 min" },
                    { v: 30, label: "30 min" },
                    { v: 0, label: "Never" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => { setIdleTimeout(o.v); setSettingsTouched(true) }}
                      className={cn(
                        "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition",
                        idleTimeout === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/20",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Stops a desktop after it&apos;s left idle, to save cost.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="ink" onClick={bootAll} disabled={bootingAll || students.length === 0}>
                  {bootingAll ? <Spinner /> : <Rocket className="size-4" />} Boot all desktops
                </Button>
                <Button variant="outline" onClick={stopAll} disabled={stoppingAll || activeCount === 0} className="text-destructive hover:bg-destructive/10">
                  {stoppingAll ? <Spinner /> : <Power className="size-4" />} Shut down all
                </Button>
                <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                  <CalendarClock className="size-4" /> Schedule
                </Button>
                {settingsTouched && (
                  <Button variant="ghost" onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? <Spinner /> : <Settings2 className="size-4" />} Save as default
                  </Button>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Students</h2>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleHandoutFile} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={handoutBusy}>
                {handoutBusy ? <Spinner className="size-3.5" /> : <FileUp className="size-3.5" />} Hand out file
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCollectOpen(true)}>
                <Inbox className="size-3.5" /> Collect work
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAttendanceOpen(true)}>
                <CalendarDays className="size-3.5" /> Attendance
              </Button>
            </div>
          </div>
          {students.length === 0 ? (
            <Card className="mt-3 items-center py-12 text-center text-muted-foreground">
              No students yet. Share the join code{" "}
              <span className="font-mono font-medium text-primary">{classroom.joinCode}</span> to get started.
            </Card>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <StudentCard
                  key={s.id}
                  student={s}
                  monthlyUnlimited={plan.monthlyUnlimited}
                  busy={!!busy[s.id]}
                  onBoot={() => bootStudent(s.id)}
                  onStop={(mid) => stopMachine(mid, s.id)}
                  onOpen={(mid) => setSelectedId(mid)}
                  onFiles={(mid) => setFilesMachine({ id: mid, name: s.name })}
                />
              ))}
            </div>
          )}
          </>
          )}
        </>
      )}

      <FilesModal
        machineId={filesMachine?.id ?? null}
        studentName={filesMachine?.name}
        open={!!filesMachine}
        onOpenChange={(v) => !v && setFilesMachine(null)}
      />
      <CollectModal classId={classId} open={collectOpen} onOpenChange={setCollectOpen} />
      <AttendanceModal
        classId={classId}
        className={classroom.name}
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
      />
      <ScheduleModal
        classId={classId}
        maxMinutes={data.plan.maxSessionMinutes}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </main>
  )
}

function StudentCard({
  student,
  monthlyUnlimited,
  busy,
  onBoot,
  onStop,
  onOpen,
  onFiles,
}: {
  student: SStudent
  monthlyUnlimited: boolean
  busy: boolean
  onBoot: () => void
  onStop: (machineId: string) => void
  onOpen: (machineId: string) => void
  onFiles: (machineId: string) => void
}) {
  const m = student.machine
  const isActive = m && ACTIVE.includes(m.status)
  const isRunning = m?.status === "RUNNING"
  const usage = student.usage
  const outOfMinutes = !monthlyUnlimited && usage != null && usage.remaining <= 0

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-secondary text-foreground">{initialsOf(student.name) || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{student.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={m?.status ?? "NONE"} />
            {isRunning && m?.remainingMs != null && (
              <span className="text-xs tabular-nums text-muted-foreground">{formatRemaining(m.remainingMs)}</span>
            )}
          </div>
        </div>
        {m && <OsIcon os={m.os} className="size-4 text-muted-foreground" />}
      </div>

      {usage && !monthlyUnlimited && (
        <p className="text-[11px] text-muted-foreground">
          {outOfMinutes ? (
            <span className="text-amber-600">Monthly desktop time used up</span>
          ) : (
            <>
              <span className="font-medium text-foreground">{usage.remaining} min</span> left this month
            </>
          )}
        </p>
      )}

      {m?.status === "ERROR" && m.errorMessage && (
        <p className="flex items-start gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {m.errorMessage}
        </p>
      )}

      <div className="mt-auto flex gap-2">
        {isRunning && m?.previewUrl ? (
          <>
            <Button variant="ink" size="sm" className="flex-1" onClick={() => onOpen(m.id)}>
              <Monitor className="size-3.5" /> Watch
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => onFiles(m.id)} title="Browse files">
              <FolderOpen className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => onStop(m.id)} disabled={busy}>
              {busy ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />}
            </Button>
          </>
        ) : isActive ? (
          <Button variant="outline" size="sm" className="flex-1" disabled>
            <Spinner className="size-3.5" /> Booting…
          </Button>
        ) : outOfMinutes ? (
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href="/teacher/billing">
              <Sparkles className="size-3.5" /> Upgrade for more time
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex-1" onClick={onBoot} disabled={busy}>
            {busy ? <Spinner className="size-3.5" /> : <PlayCircle className="size-3.5" />} Boot desktop
          </Button>
        )}
      </div>
    </Card>
  )
}
