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
  UserPlus,
  Hand,
  Boxes,
  Check,
  Flame,
  UsersRound,
  Clock3,
  Megaphone,
  KeyRound,
  ClipboardList,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  MessageSquare,
} from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { CopyButton } from "@/components/CopyButton"
import { OsPicker, DurationPicker } from "@/components/Pickers"
import { DesktopViewer } from "@/components/DesktopViewer"
import { MonitorWall } from "./MonitorWall"
import { ActivityLog } from "./ActivityLog"
import { GroupsPanel } from "./GroupsPanel"
import { FilesModal } from "@/components/FilesModal"
import { CollectModal } from "@/components/CollectModal"
import { AttendanceModal } from "@/components/AttendanceModal"
import { ScheduleModal } from "@/components/ScheduleModal"
import { RosterModal } from "@/components/RosterModal"
import { AnnounceModal } from "@/components/AnnounceModal"
import { PollModal } from "@/components/PollModal"
import { PreflightModal } from "@/components/PreflightModal"
import { AssignmentsModal } from "@/components/AssignmentsModal"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { api, formatRemaining, formatDurationLabel } from "@/lib/client"
import { initialsOf, cn } from "@/lib/utils"
import type { OsType } from "@/lib/os"
import { CATALOG, matchCatalog } from "@/lib/catalog"

interface SMachine {
  id: string
  studentId: string | null
  studentName: string | null
  groupId: string | null
  groupName: string | null
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
  flag: { kind: string | null; note: string | null; at: string } | null
  groupId: string | null
  hasPin: boolean
}
interface SGroup {
  id: string
  name: string
  students: { id: string; name: string }[]
  machine: SMachine | null
}
interface SClassroom {
  id: string
  name: string
  joinCode: string
  defaultOs: OsType
  snapshot: string | null
  defaultDurationMin: number
  allowStudentBoot: boolean
  idleTimeoutMin: number
  netMode: "open" | "allowlist" | "blocked"
  allowedDomains: string | null
  examMode: boolean
  examMessage: string | null
  requireJoinPin: boolean
  announcement: string | null
  locked: boolean
  lms: { roster: boolean; grades: boolean }
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
  groups: SGroup[]
  usageSummary: { totalMinutes: number; estimatedCostCents: number }
}

const ACTIVE = ["PROVISIONING", "RUNNING"]

export function ClassManager({ classId }: { classId: string }) {
  const toast = useToast()
  const [data, setData] = useState<ClassData | null>(null)
  const [os, setOs] = useState<OsType>("linux")
  const [duration, setDuration] = useState(60)
  const [idleTimeout, setIdleTimeout] = useState(20)
  const [netMode, setNetMode] = useState<"open" | "allowlist" | "blocked">("open")
  const [allowedDomains, setAllowedDomains] = useState("")
  const [snapshot, setSnapshot] = useState("")
  const [resolvingFlags, setResolvingFlags] = useState(false)
  const [examMode, setExamMode] = useState(false)
  const [examBusy, setExamBusy] = useState(false)
  const [settingsTouched, setSettingsTouched] = useState(false)
  const [bootingAll, setBootingAll] = useState(false)
  const [stoppingAll, setStoppingAll] = useState(false)
  const [prewarming, setPrewarming] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"students" | "groups" | "wall" | "activity">("students")
  const [filesMachine, setFilesMachine] = useState<{ id: string; name: string | null } | null>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const [handoutBusy, setHandoutBusy] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)
  const [assignmentsOpen, setAssignmentsOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [announceOpen, setAnnounceOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [preflightOpen, setPreflightOpen] = useState(false)
  const [pinBusy, setPinBusy] = useState(false)
  const [nrpsBusy, setNrpsBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  const load = useCallback(async () => {
    try {
      const d = await api<ClassData>(`/api/classes/${classId}`)
      setData(d)
      setExamMode(d.classroom.examMode)
      if (!initialized.current) {
        setOs(d.classroom.defaultOs)
        setDuration(Math.min(d.classroom.defaultDurationMin, d.plan.maxSessionMinutes))
        setIdleTimeout(d.classroom.idleTimeoutMin)
        setNetMode(d.classroom.netMode)
        setAllowedDomains(d.classroom.allowedDomains ?? "")
        setSnapshot(d.classroom.snapshot ?? "")
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
        body: {
          defaultOs: os,
          defaultDurationMin: duration,
          idleTimeoutMin: idleTimeout,
          netMode,
          allowedDomains: allowedDomains.trim() || null,
          snapshot: snapshot.trim() || null,
        },
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

  async function resolveFlag(studentId: string | null) {
    setResolvingFlags(true)
    try {
      await api(`/api/classes/${classId}/resolve-flag`, { method: "POST", body: { studentId } })
      load()
    } catch (e) {
      toast.error("Could not resolve", (e as Error).message)
    } finally {
      setResolvingFlags(false)
    }
  }

  async function syncFromLms() {
    setNrpsBusy(true)
    try {
      const r = await api<{ added: number; updated: number; archived: number }>(
        `/api/classes/${classId}/nrps-sync`,
        { method: "POST" },
      )
      toast.success("Roster synced from LMS", `+${r.added} added, ${r.updated} updated, ${r.archived} archived.`)
      load()
    } catch (e) {
      toast.error("Could not sync from LMS", (e as Error).message)
    } finally {
      setNrpsBusy(false)
    }
  }

  async function toggleRequirePin(on: boolean) {
    setPinBusy(true)
    try {
      await api(`/api/classes/${classId}`, { method: "PATCH", body: { requireJoinPin: on } })
      toast[on ? "info" : "success"](
        on ? "Join PIN required" : "Join PIN no longer required",
        on
          ? "Students set a PIN on their next join; it's required after that."
          : "Students can join with just the class code and their name.",
      )
      load()
    } catch (e) {
      toast.error("Could not change PIN setting", (e as Error).message)
    } finally {
      setPinBusy(false)
    }
  }

  async function nudgeStudent(studentId: string, name: string) {
    const text = window.prompt(`Private message to ${name} (leave blank to clear):`)
    if (text === null) return
    try {
      await api(`/api/students/${studentId}/nudge`, { method: "POST", body: { text: text.trim() || null } })
      toast.success(text.trim() ? `Sent ${name} a private note` : `Cleared ${name}'s note`)
      load()
    } catch (e) {
      toast.error("Could not send message", (e as Error).message)
    }
  }

  async function setStudentPin(studentId: string, name: string) {
    const input = window.prompt(
      `Set a join PIN for ${name} (4–12 characters). Leave blank to clear it so they set their own next time.`,
    )
    if (input === null) return
    const pin = input.trim()
    if (pin && (pin.length < 4 || pin.length > 12)) {
      toast.error("PIN must be 4–12 characters")
      return
    }
    try {
      await api(`/api/students/${studentId}/pin`, { method: "POST", body: { pin: pin || null } })
      toast.success(pin ? `PIN set for ${name}` : `PIN cleared for ${name}`)
      load()
    } catch (e) {
      toast.error("Could not update PIN", (e as Error).message)
    }
  }

  async function toggleExam(on: boolean) {
    setExamBusy(true)
    try {
      await api(`/api/classes/${classId}`, { method: "PATCH", body: { examMode: on } })
      toast[on ? "info" : "success"](
        on ? "Exam mode on" : "Exam mode off",
        on ? "Students see an exam banner and can't shut down their desktop." : "Students can use their desktops normally.",
      )
      load()
    } catch (e) {
      toast.error("Could not change exam mode", (e as Error).message)
    } finally {
      setExamBusy(false)
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
        body: { defaultOs: os, defaultDurationMin: duration, idleTimeoutMin: idleTimeout, snapshot: snapshot.trim() || null },
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

  async function prewarm() {
    setPrewarming(true)
    try {
      const r = await api<{ warmed: number; alreadyWarm: number; failed: number }>(
        `/api/classes/${classId}/prewarm`,
        { method: "POST" },
      )
      if (r.warmed > 0) {
        toast.success(
          `Pre-warmed ${r.warmed} desktop${r.warmed === 1 ? "" : "s"}`,
          "Their files are ready, so the first boot will be quick.",
        )
      } else {
        toast.info("Already warmed up", "Every student's files are provisioned.")
      }
      if (r.failed > 0) toast.error(`${r.failed} could not be pre-warmed`, "Try again in a moment.")
    } catch (e) {
      toast.error("Could not pre-warm", (e as Error).message)
    } finally {
      setPrewarming(false)
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

  async function extendTime(machineId: string, deltaMinutes: number) {
    try {
      await api(`/api/machines/${machineId}/time`, { method: "PATCH", body: { deltaMinutes } })
      toast.success(
        deltaMinutes >= 0 ? `Added ${deltaMinutes} minutes` : `Removed ${Math.abs(deltaMinutes)} minutes`,
        "The countdown and shutdown timer updated.",
      )
      load()
    } catch (err) {
      toast.error("Could not adjust time", (err as Error).message)
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
  const flaggedStudents = students.filter((s) => s.flag)
  const selectedMachine =
    selectedId != null ? data.machines.find((m) => m.id === selectedId) ?? null : null
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
              Watching {selectedMachine.studentName ?? `${selectedMachine.groupName} group`}&apos;s desktop
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => extendTime(selectedMachine.id, -5)} title="Trim 5 minutes">
                <Clock3 className="size-3.5" /> −5 min
              </Button>
              <Button variant="outline" size="sm" onClick={() => extendTime(selectedMachine.id, 10)} title="Grant 10 more minutes">
                <Clock3 className="size-3.5" /> +10 min
              </Button>
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
            onStop={() => stopMachine(selectedMachine.id, selectedMachine.studentId ?? selectedMachine.id)}
            stopping={busy[selectedMachine.studentId ?? selectedMachine.id]}
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
                variant={classroom.announcement ? "ink" : "outline"}
                size="sm"
                onClick={() => setAnnounceOpen(true)}
                title={classroom.announcement ? `Announcement live: ${classroom.announcement}` : "Post an announcement"}
              >
                <Megaphone className="size-3.5" />
                {classroom.announcement ? "Announcing" : "Announce"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPollOpen(true)} title="Run a live poll / exit ticket">
                <ListChecks className="size-3.5" /> Poll
              </Button>
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
                onClick={() => setView("groups")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  view === "groups" ? "bg-ink text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <UsersRound className="size-3.5" /> Groups
                {data.groups.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-foreground">
                    {data.groups.length}
                  </span>
                )}
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

          {flaggedStudents.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Hand className="size-4" />
                  {flaggedStudents.length} student{flaggedStudents.length === 1 ? "" : "s"} need help
                </p>
                <Button variant="outline" size="sm" onClick={() => resolveFlag(null)} disabled={resolvingFlags}>
                  <Check className="size-3.5" /> Clear all
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {flaggedStudents.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-card px-3 py-1 text-xs text-foreground"
                  >
                    {s.flag?.kind === "report" ? (
                      <AlertTriangle className="size-3.5 text-amber-600" />
                    ) : (
                      <Hand className="size-3.5 text-amber-600" />
                    )}
                    <span className="font-medium">{s.name}</span>
                    {s.flag?.note && <span className="text-muted-foreground">“{s.flag.note}”</span>}
                    {s.machine?.status === "RUNNING" && (
                      <button
                        onClick={() => setSelectedId(s.machine!.id)}
                        className="cursor-pointer font-medium text-primary hover:underline"
                      >
                        watch
                      </button>
                    )}
                    <button
                      onClick={() => resolveFlag(s.id)}
                      disabled={resolvingFlags}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                      title="Resolve"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {view === "wall" ? (
            <MonitorWall classId={classId} />
          ) : view === "activity" ? (
            <ActivityLog classId={classId} usage={data.usageSummary} />
          ) : view === "groups" ? (
            <GroupsPanel
              classId={classId}
              groups={data.groups}
              students={students.map((s) => ({ id: s.id, name: s.name, groupId: s.groupId }))}
              onChange={load}
              onWatch={(mid) => setSelectedId(mid)}
              onFiles={(mid, name) => setFilesMachine({ id: mid, name })}
            />
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
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Boxes className="size-3.5" /> Environment image
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATALOG.map((img) => {
                    const active = matchCatalog(os, snapshot.trim() || null)?.id === img.id
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => {
                          setOs(img.os)
                          setSnapshot(img.snapshot ?? "")
                          setSettingsTouched(true)
                        }}
                        title={img.description}
                        className={cn(
                          "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:border-foreground/20",
                        )}
                      >
                        <span className="mr-1">{img.emoji}</span>
                        {img.name}
                        {img.requiresOrgImage && (
                          <span className={cn("ml-1.5 text-[10px]", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            • org image
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <Input
                  value={snapshot}
                  onChange={(e) => { setSnapshot(e.target.value); setSettingsTouched(true) }}
                  placeholder="Custom Daytona snapshot (advanced) — leave blank for default"
                />
                <p className="text-xs text-muted-foreground">
                  Pin a pre-built golden image so every desktop boots identically. Custom and “org image”
                  options require that snapshot to be published on your Daytona organization.
                </p>
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

              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internet</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { v: "open", label: "Open" },
                    { v: "allowlist", label: "Allowlist only" },
                    { v: "blocked", label: "No internet" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => { setNetMode(o.v); setSettingsTouched(true) }}
                      className={cn(
                        "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition",
                        netMode === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/20",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {netMode === "allowlist" && (
                  <Input
                    value={allowedDomains}
                    onChange={(e) => { setAllowedDomains(e.target.value); setSettingsTouched(true) }}
                    placeholder="khanacademy.org, wikipedia.org"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Enforced at the network layer on desktops booted after saving.
                </p>
              </div>

              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3.5">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Exam mode</span>
                  <span className="block text-xs text-muted-foreground">
                    Students see an exam banner and can&apos;t shut down. Pair with a restricted internet policy.
                  </span>
                </span>
                <Switch checked={examMode} onCheckedChange={toggleExam} disabled={examBusy} />
              </label>

              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3.5">
                <span className="text-sm">
                  <span className="font-medium text-foreground">Require a PIN to join</span>
                  <span className="block text-xs text-muted-foreground">
                    Stops students from joining as a classmate. Each student sets a PIN on their next join;
                    reset it from their card if they forget.
                  </span>
                </span>
                <Switch checked={classroom.requireJoinPin} onCheckedChange={toggleRequirePin} disabled={pinBusy} />
              </label>

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
                <Button variant="outline" onClick={prewarm} disabled={prewarming || students.length === 0}>
                  {prewarming ? <Spinner /> : <Flame className="size-4" />} Pre-warm
                </Button>
                <Button variant="outline" onClick={() => setPreflightOpen(true)}>
                  <ShieldCheck className="size-4" /> Class ready?
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
              {classroom.lms.roster && (
                <Button variant="outline" size="sm" onClick={syncFromLms} disabled={nrpsBusy}>
                  {nrpsBusy ? <Spinner className="size-3.5" /> : <GraduationCap className="size-3.5" />} Sync from LMS
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setRosterOpen(true)}>
                <UserPlus className="size-3.5" /> Add students
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={handoutBusy}>
                {handoutBusy ? <Spinner className="size-3.5" /> : <FileUp className="size-3.5" />} Hand out file
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCollectOpen(true)}>
                <Inbox className="size-3.5" /> Collect work
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAssignmentsOpen(true)}>
                <ClipboardList className="size-3.5" /> Assignments
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAttendanceOpen(true)}>
                <CalendarDays className="size-3.5" /> Attendance
              </Button>
            </div>
          </div>
          {students.length === 0 ? (
            <Card className="mt-3 items-center gap-3 py-12 text-center text-muted-foreground">
              <p>
                No students yet. Share the join code{" "}
                <span className="font-mono font-medium text-primary">{classroom.joinCode}</span>, or add a roster
                now.
              </p>
              <Button variant="outline" size="sm" onClick={() => setRosterOpen(true)}>
                <UserPlus className="size-3.5" /> Add students
              </Button>
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
                  onExtend={(mid) => extendTime(mid, 10)}
                  requirePin={classroom.requireJoinPin}
                  onPin={() => setStudentPin(s.id, s.name)}
                  onNudge={() => nudgeStudent(s.id, s.name)}
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
      <RosterModal classId={classId} open={rosterOpen} onOpenChange={setRosterOpen} onAdded={load} />
      <AnnounceModal
        classId={classId}
        current={classroom.announcement}
        open={announceOpen}
        onOpenChange={setAnnounceOpen}
        onChanged={load}
      />
      <AssignmentsModal
        classId={classId}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        open={assignmentsOpen}
        onOpenChange={setAssignmentsOpen}
      />
      <PollModal classId={classId} open={pollOpen} onOpenChange={setPollOpen} />
      <PreflightModal classId={classId} open={preflightOpen} onOpenChange={setPreflightOpen} />
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
  onExtend,
  requirePin,
  onPin,
  onNudge,
}: {
  student: SStudent
  monthlyUnlimited: boolean
  busy: boolean
  onBoot: () => void
  onStop: (machineId: string) => void
  onOpen: (machineId: string) => void
  onFiles: (machineId: string) => void
  onExtend: (machineId: string) => void
  requirePin: boolean
  onPin: () => void
  onNudge: () => void
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
            {student.flag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <Hand className="size-3" /> {student.flag.kind === "report" ? "Reported" : "Help"}
              </span>
            )}
            {student.groupId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                <UsersRound className="size-3" /> Group
              </span>
            )}
            {requirePin && (
              <button
                onClick={onPin}
                title="Set or reset this student's join PIN"
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition",
                  student.hasPin
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-amber-100 text-amber-700 hover:bg-amber-200",
                )}
              >
                <KeyRound className="size-3" /> {student.hasPin ? "PIN set" : "No PIN"}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onNudge}
          title="Send a private message"
          className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-primary"
        >
          <MessageSquare className="size-4" />
        </button>
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
        {student.groupId ? (
          <p className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-xs text-muted-foreground">
            <UsersRound className="size-3.5 text-violet-600" /> Shares a group desktop — manage it in the Groups tab.
          </p>
        ) : isRunning && m?.previewUrl ? (
          <>
            <Button variant="ink" size="sm" className="flex-1" onClick={() => onOpen(m.id)}>
              <Monitor className="size-3.5" /> Watch
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => onExtend(m.id)} title="Add 10 minutes">
              <Clock3 className="size-3.5" />
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
