"use client"

import { useCallback, useEffect, useState } from "react"
import { Rocket, HardDrive, Clock, AlertTriangle, Hourglass, FolderOpen, Lock, Eye, Radio, Hand, Flag, UsersRound, Megaphone, X, ListChecks, Check, Send } from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { DesktopViewer } from "@/components/DesktopViewer"
import { FilesModal } from "@/components/FilesModal"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, formatDurationLabel } from "@/lib/client"
import { cn } from "@/lib/utils"
import type { OsType } from "@/lib/os"

interface SMachine {
  id: string
  os: string
  status: string
  previewUrl: string | null
  errorMessage: string | null
  durationMin: number
  expiresAt: string | null
  remainingMs: number | null
}
interface Payload {
  student: { id: string; name: string; hasFiles: boolean; connectionSaver: boolean }
  classroom: {
    id: string
    name: string
    defaultOs: OsType
    defaultDurationMin: number
    allowStudentBoot: boolean
    locked: boolean
    lockMessage: string | null
    examMode: boolean
    examMessage: string | null
    announcement: string | null
    announcementAt: string | null
  }
  usage: { remaining: number; unlimited: boolean; sessionCap: number }
  machine: SMachine | null
  beingWatched: boolean
  spotlight: { tileUrl: string; presenterName: string | null } | null
  flag: { kind: string | null; at: string } | null
  group: { id: string; name: string } | null
  activePoll: {
    id: string
    prompt: string
    type: string
    options: string[]
    responded: boolean
    myChoice: number | null
  } | null
  nudge: { text: string; at: string } | null
  timeRequested: boolean
}

export function StudentDashboard() {
  const toast = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [booting, setBooting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [flagBusy, setFlagBusy] = useState(false)
  const [dismissedAnn, setDismissedAnn] = useState<string | null>(null)
  const [dismissedNudge, setDismissedNudge] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>("/api/student/machine"))
    } catch (err) {
      toast.error("Could not load your desktop", (err as Error).message)
    }
  }, [toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  async function boot() {
    setBooting(true)
    try {
      await api("/api/student/boot", { method: "POST" })
      toast.success("Starting your desktop", "Hang tight — this takes a few seconds.")
      load()
    } catch (err) {
      toast.error("Could not start desktop", (err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  async function raiseHand(kind: "help" | "report") {
    setFlagBusy(true)
    try {
      if (kind === "report") {
        const note = window.prompt("Briefly describe what you want to report to your teacher (optional):") ?? undefined
        await api("/api/student/flag", { method: "POST", body: { kind, note } })
        toast.success("Reported to your teacher", "They'll take a look as soon as they can.")
      } else {
        await api("/api/student/flag", { method: "POST", body: { kind } })
        toast.success("Hand raised", "Your teacher has been notified.")
      }
      load()
    } catch (err) {
      toast.error("Could not notify your teacher", (err as Error).message)
    } finally {
      setFlagBusy(false)
    }
  }

  async function lowerHand() {
    setFlagBusy(true)
    try {
      await api("/api/student/flag", { method: "DELETE" })
      load()
    } catch (err) {
      toast.error("Could not update", (err as Error).message)
    } finally {
      setFlagBusy(false)
    }
  }

  async function stop() {
    if (!data?.machine) return
    setStopping(true)
    try {
      await api(`/api/machines/${data.machine.id}/stop`, { method: "POST" })
      toast.info("Desktop shut down", "Your files in My-Files are saved.")
      load()
    } catch (err) {
      toast.error("Could not shut down", (err as Error).message)
    } finally {
      setStopping(false)
    }
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 justify-center px-5 py-20 text-muted-foreground">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { classroom, machine, student, usage, beingWatched, spotlight, flag, group, activePoll, nudge, timeRequested } = data

  async function askForTime() {
    try {
      await api("/api/student/request-time", { method: timeRequested ? "DELETE" : "POST" })
      toast[timeRequested ? "info" : "success"](
        timeRequested ? "Request withdrawn" : "Asked for more time",
        timeRequested ? undefined : "Your teacher has been notified.",
      )
      load()
    } catch (err) {
      toast.error("Could not send request", (err as Error).message)
    }
  }

  async function respondPoll(body: { choice?: number; text?: string }) {
    if (!activePoll) return
    try {
      await api(`/api/classes/${classroom.id}/polls/${activePoll.id}/respond`, { method: "POST", body })
      toast.success("Answer submitted")
      load()
    } catch (err) {
      toast.error("Could not submit answer", (err as Error).message)
    }
  }
  const isRunning = machine?.status === "RUNNING" && machine.previewUrl
  const isBooting = machine && machine.status === "PROVISIONING"

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      {classroom.locked && <LockOverlay message={classroom.lockMessage} />}
      {!classroom.locked && spotlight && (
        <SpotlightOverlay tileUrl={spotlight.tileUrl} presenterName={spotlight.presenterName} />
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{classroom.name}</p>
          <h1 className="font-display mt-1 text-3xl text-foreground">
            {isRunning
              ? group
                ? `${group.name} — live`
                : "Your desktop is live"
              : `Hi ${student.name.split(" ")[0]} 👋`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {flag ? (
            <Button variant="outline" size="sm" onClick={lowerHand} disabled={flagBusy} className="border-amber-300 text-amber-700">
              <Hand className="size-3.5" /> {flag.kind === "report" ? "Reported" : "Hand raised"} — lower
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => raiseHand("help")} disabled={flagBusy}>
                <Hand className="size-3.5" /> Raise hand
              </Button>
              <Button variant="ghost" size="sm" onClick={() => raiseHand("report")} disabled={flagBusy} title="Report something to your teacher">
                <Flag className="size-3.5" /> Report
              </Button>
            </>
          )}
          {machine && <StatusBadge status={machine.status} />}
        </div>
      </div>

      {classroom.announcement && classroom.announcementAt !== dismissedAnn && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
        >
          <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="font-semibold">Announcement: </span>
            {classroom.announcement}
          </span>
          <button
            onClick={() => setDismissedAnn(classroom.announcementAt)}
            className="cursor-pointer rounded p-0.5 text-muted-foreground transition hover:text-foreground"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {nudge && nudge.at !== dismissedNudge && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <Hand className="mt-0.5 size-4 shrink-0 text-indigo-500" />
          <span className="flex-1">
            <span className="font-semibold">A note from your teacher: </span>
            {nudge.text}
          </span>
          <button onClick={() => setDismissedNudge(nudge.at)} className="cursor-pointer rounded p-0.5 text-indigo-400 transition hover:text-indigo-700" title="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      {activePoll && <PollCard poll={activePoll} onSubmit={respondPoll} />}

      {isRunning ? (
        <div className="mt-5 space-y-4">
          {classroom.examMode && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <Lock className="size-4" />
              <span>
                <strong>Exam mode is on.</strong>{" "}
                {classroom.examMessage || "Stay on this desktop until your teacher ends the exam."}
              </span>
            </div>
          )}
          {beingWatched && (
            <div className="flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm text-sky-800">
              <Eye className="size-4" />
              Your teacher is viewing your screen.
            </div>
          )}
          {group && (
            <div className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
              <UsersRound className="size-4" />
              <span>
                This is your group <strong>{group.name}</strong>&apos;s shared desktop — your teammates see and
                control the same screen.
              </span>
            </div>
          )}
          <DesktopViewer
            machine={machine!}
            onStop={classroom.examMode ? undefined : stop}
            stopping={stopping}
            connectionSaver={student.connectionSaver}
            autoFullscreen
          />
          <Card className="flex-row items-center gap-3 p-4">
            <FolderOpen className="size-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-foreground/80">
              Save anything you want to keep in the <strong className="text-foreground">My-Files</strong> folder on
              the desktop. It stays safe even after this machine shuts down — it&apos;ll be there next time you log
              in.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={askForTime}
              className={timeRequested ? "border-amber-300 text-amber-700" : undefined}
            >
              <Hourglass className="size-3.5" /> {timeRequested ? "Time requested" : "Ask for more time"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFilesOpen(true)}>
              <FolderOpen className="size-3.5" /> Browse my files
            </Button>
          </Card>
        </div>
      ) : isBooting ? (
        <Card className="mt-5 items-center py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-amber-100">
            <Spinner className="size-7 text-amber-600" />
          </div>
          <h2 className="font-display mt-4 text-2xl text-foreground">Starting your desktop…</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            We&apos;re booting your {machine?.os === "windows" ? "Windows" : "Linux"} machine and mounting your
            files. This usually takes 10–30 seconds.
          </p>
        </Card>
      ) : (
        <BootCard
          os={classroom.defaultOs}
          duration={usage.sessionCap}
          allowStudentBoot={classroom.allowStudentBoot}
          machine={machine}
          hasFiles={student.hasFiles}
          usage={usage}
          booting={booting}
          onBoot={boot}
          groupName={group?.name ?? null}
        />
      )}

      <FilesModal
        machineId={machine?.id ?? null}
        open={filesOpen}
        onOpenChange={setFilesOpen}
      />
    </main>
  )
}

function PollCard({
  poll,
  onSubmit,
}: {
  poll: { id: string; prompt: string; type: string; options: string[]; responded: boolean; myChoice: number | null }
  onSubmit: (body: { choice?: number; text?: string }) => void
}) {
  const [text, setText] = useState("")
  return (
    <Card className="mt-5 gap-3 border-primary/30 bg-primary/5 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <ListChecks className="size-4" /> {poll.responded ? "Answer submitted — you can change it" : "Your teacher asks"}
      </p>
      <p className="text-lg font-medium text-foreground">{poll.prompt}</p>
      {poll.type === "mcq" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {poll.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSubmit({ choice: i })}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                poll.myChoice === i
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              {poll.myChoice === i && <Check className="size-4 shrink-0" />}
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && text.trim() && onSubmit({ text: text.trim() })}
            placeholder="Type your answer…"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <Button variant="ink" onClick={() => text.trim() && onSubmit({ text: text.trim() })}>
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      )}
    </Card>
  )
}

function SpotlightOverlay({
  tileUrl,
  presenterName,
}: {
  tileUrl: string
  presenterName: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-4 backdrop-blur-sm sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 pb-3 text-background">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-primary-foreground">
          <Radio className="size-4 animate-pulse text-primary" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-background/60">Your teacher is presenting</p>
          <h2 className="font-display text-xl leading-tight text-background">
            {presenterName ? `${presenterName}'s screen` : "A classmate's screen"}
          </h2>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
        <iframe
          src={tileUrl}
          tabIndex={-1}
          className="pointer-events-none size-full"
          title="Spotlighted desktop"
        />
      </div>
      <p className="mx-auto mt-3 w-full max-w-6xl text-center text-xs text-background/50">
        This is a view-only broadcast — it will close when your teacher ends it.
      </p>
    </div>
  )
}

function LockOverlay({ message }: { message: string | null }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/95 px-6 text-center backdrop-blur-sm">
      <div className="grid size-16 place-items-center rounded-2xl bg-white/10 text-background">
        <Lock className="size-8" />
      </div>
      <h2 className="font-display mt-6 text-3xl text-background">Eyes on me</h2>
      <p className="mt-2 max-w-md text-background/70">
        {message || "Your teacher has paused the class. Your desktop is safe and will be back in a moment."}
      </p>
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-background/60">
        <span className="size-1.5 animate-pulse rounded-full bg-amber-400" /> Screen locked by teacher
      </p>
    </div>
  )
}

function BootCard({
  os,
  duration,
  allowStudentBoot,
  machine,
  hasFiles,
  usage,
  booting,
  onBoot,
  groupName,
}: {
  os: OsType
  duration: number
  allowStudentBoot: boolean
  machine: SMachine | null
  hasFiles: boolean
  usage: { remaining: number; unlimited: boolean; sessionCap: number }
  booting: boolean
  onBoot: () => void
  groupName: string | null
}) {
  const ended = machine && ["STOPPED", "EXPIRED"].includes(machine.status)
  const errored = machine?.status === "ERROR"
  // Group desktops aren't metered against an individual student's monthly minutes.
  const outOfMinutes = !groupName && !usage.unlimited && usage.remaining <= 0

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]">
      <Card className="items-start p-7">
        <div className="grid size-14 place-items-center rounded-2xl bg-ink text-background">
          <OsIcon os={os} className="size-7" />
        </div>
        <h2 className="font-display mt-4 text-2xl text-foreground">
          {outOfMinutes ? "Out of time this month" : ended ? "Session ended" : errored ? "Something went wrong" : "Ready when you are"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {outOfMinutes
            ? "You’ve used all your desktop time for this month. Your files are saved — ask your teacher if you need more."
            : ended
              ? "Your previous desktop was shut down. Your files are saved — boot a fresh one any time."
              : errored
                ? "We couldn’t start your last desktop. You can try again."
                : groupName
                  ? `Boot your group ${groupName}’s shared desktop — your teammates join the very same machine.`
                  : `Boot a ${os === "windows" ? "Windows" : "Linux"} desktop right in this browser tab.`}
        </p>

        {errored && machine?.errorMessage && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {machine.errorMessage}
          </p>
        )}

        {outOfMinutes ? (
          <p className="mt-6 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Hourglass className="size-4" /> No desktop time left this month.
          </p>
        ) : allowStudentBoot ? (
          <Button variant="ink" size="lg" className="mt-6" onClick={onBoot} disabled={booting}>
            {booting ? <Spinner /> : <Rocket className="size-4" />}
            {groupName ? "Boot group desktop" : ended || errored ? "Boot a new desktop" : "Boot my desktop"}
          </Button>
        ) : (
          <p className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            <Hourglass className="size-4 text-amber-600" /> Waiting for your teacher to start your desktop.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        <InfoTile icon={<OsIcon os={os} className="size-4" />} label="Operating system" value={os === "windows" ? "Windows" : "Linux"} />
        <InfoTile icon={<Clock className="size-4 text-amber-600" />} label="Session length" value={formatDurationLabel(duration)} />
        <InfoTile
          icon={<HardDrive className="size-4 text-primary" />}
          label="Your files"
          value={hasFiles ? "Saved & ready" : "New volume"}
          hint="Mounted as “My-Files” on the desktop"
        />
        {!usage.unlimited && (
          <InfoTile icon={<Clock className="size-4 text-emerald-600" />} label="Time left this month" value={`${Math.max(0, usage.remaining)} min`} />
        )}
      </div>
    </div>
  )
}

function InfoTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-secondary">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  )
}
