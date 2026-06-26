"use client"

import { useCallback, useEffect, useState } from "react"
import { Rocket, HardDrive, Clock, AlertTriangle, Hourglass, FolderOpen, Lock } from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { DesktopViewer } from "@/components/DesktopViewer"
import { FilesModal } from "@/components/FilesModal"
import { useToast } from "@/components/Toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, formatDurationLabel } from "@/lib/client"
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
  student: { id: string; name: string; hasFiles: boolean }
  classroom: {
    id: string
    name: string
    defaultOs: OsType
    defaultDurationMin: number
    allowStudentBoot: boolean
    locked: boolean
    lockMessage: string | null
  }
  usage: { remaining: number; unlimited: boolean; sessionCap: number }
  machine: SMachine | null
}

export function StudentDashboard() {
  const toast = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [booting, setBooting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)

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

  const { classroom, machine, student, usage } = data
  const isRunning = machine?.status === "RUNNING" && machine.previewUrl
  const isBooting = machine && machine.status === "PROVISIONING"

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      {classroom.locked && <LockOverlay message={classroom.lockMessage} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{classroom.name}</p>
          <h1 className="font-display mt-1 text-3xl text-foreground">
            {isRunning ? "Your desktop is live" : `Hi ${student.name.split(" ")[0]} 👋`}
          </h1>
        </div>
        {machine && <StatusBadge status={machine.status} />}
      </div>

      {isRunning ? (
        <div className="mt-5 space-y-4">
          <DesktopViewer machine={machine!} onStop={stop} stopping={stopping} />
          <Card className="flex-row items-center gap-3 p-4">
            <FolderOpen className="size-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-foreground/80">
              Save anything you want to keep in the <strong className="text-foreground">My-Files</strong> folder on
              the desktop. It stays safe even after this machine shuts down — it&apos;ll be there next time you log
              in.
            </p>
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
}: {
  os: OsType
  duration: number
  allowStudentBoot: boolean
  machine: SMachine | null
  hasFiles: boolean
  usage: { remaining: number; unlimited: boolean; sessionCap: number }
  booting: boolean
  onBoot: () => void
}) {
  const ended = machine && ["STOPPED", "EXPIRED"].includes(machine.status)
  const errored = machine?.status === "ERROR"
  const outOfMinutes = !usage.unlimited && usage.remaining <= 0

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
            {ended || errored ? "Boot a new desktop" : "Boot my desktop"}
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
