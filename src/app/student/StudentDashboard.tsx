'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Rocket,
  HardDrive,
  Clock,
  AlertTriangle,
  Hourglass,
  FolderOpen,
} from 'lucide-react'
import { Spinner, StatusBadge, OsIcon } from '@/components/ui'
import { DesktopViewer } from '@/components/DesktopViewer'
import { useToast } from '@/components/Toast'
import { api, formatDurationLabel } from '@/lib/client'
import type { OsType } from '@/lib/os'

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
  }
  usage: { remaining: number; unlimited: boolean; sessionCap: number }
  machine: SMachine | null
}

const ACTIVE = ['PROVISIONING', 'RUNNING']

export function StudentDashboard() {
  const toast = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [booting, setBooting] = useState(false)
  const [stopping, setStopping] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api<Payload>('/api/student/machine')
      setData(d)
    } catch (err) {
      toast.error('Could not load your desktop', (err as Error).message)
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
      await api('/api/student/boot', { method: 'POST' })
      toast.success('Starting your desktop', 'Hang tight — this takes a few seconds.')
      load()
    } catch (err) {
      toast.error('Could not start desktop', (err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  async function stop() {
    if (!data?.machine) return
    setStopping(true)
    try {
      await api(`/api/machines/${data.machine.id}/stop`, { method: 'POST' })
      toast.info('Desktop shut down', 'Your files in My-Files are saved.')
      load()
    } catch (err) {
      toast.error('Could not shut down', (err as Error).message)
    } finally {
      setStopping(false)
    }
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 justify-center px-5 py-20 text-slate-500">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { classroom, machine, student, usage } = data
  const isRunning = machine?.status === 'RUNNING' && machine.previewUrl
  const isBooting = machine && machine.status === 'PROVISIONING'

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{classroom.name}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
            {isRunning ? 'Your desktop is live' : `Hi ${student.name.split(' ')[0]} 👋`}
          </h1>
        </div>
        {machine && (
          <div className="flex items-center gap-2">
            <StatusBadge status={machine.status} />
          </div>
        )}
      </div>

      {isRunning ? (
        <div className="mt-5 space-y-4">
          <DesktopViewer machine={machine!} onStop={stop} stopping={stopping} />
          <div className="card flex items-center gap-3 p-4">
            <FolderOpen className="size-5 shrink-0 text-cyan-300" />
            <p className="text-sm text-slate-300">
              Save anything you want to keep in the <strong className="text-white">My-Files</strong>{' '}
              folder on the desktop. It stays safe even after this machine shuts down — it&apos;ll be
              there next time you log in.
            </p>
          </div>
        </div>
      ) : isBooting ? (
        <div className="card mt-5 flex flex-col items-center px-6 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-amber-500/15">
            <Spinner className="size-7 text-amber-300" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Starting your desktop…</h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-400">
            We&apos;re booting your {machine?.os === 'windows' ? 'Windows' : 'Linux'} machine and
            mounting your files. This usually takes 10–30 seconds.
          </p>
        </div>
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
    </main>
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
  const ended = machine && ['STOPPED', 'EXPIRED'].includes(machine.status)
  const errored = machine?.status === 'ERROR'
  const outOfMinutes = !usage.unlimited && usage.remaining <= 0

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]">
      <div className="card flex flex-col items-start p-7">
        <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <OsIcon os={os} className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">
          {outOfMinutes
            ? 'Out of time this month'
            : ended
              ? 'Session ended'
              : errored
                ? 'Something went wrong'
                : 'Ready when you are'}
        </h2>
        <p className="mt-1.5 text-sm text-slate-400">
          {outOfMinutes
            ? 'You’ve used all your desktop time for this month. Your files are saved — ask your teacher if you need more.'
            : ended
              ? 'Your previous desktop was shut down. Your files are saved — boot a fresh one any time.'
              : errored
                ? 'We couldn’t start your last desktop. You can try again.'
                : `Boot a ${os === 'windows' ? 'Windows' : 'Linux'} desktop right in this browser tab.`}
        </p>

        {errored && machine?.errorMessage && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {machine.errorMessage}
          </p>
        )}

        {outOfMinutes ? (
          <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <Hourglass className="size-4" />
            No desktop time left this month.
          </p>
        ) : allowStudentBoot ? (
          <button onClick={onBoot} disabled={booting} className="btn-primary mt-6">
            {booting ? <Spinner /> : <Rocket className="size-4" />}
            {ended || errored ? 'Boot a new desktop' : 'Boot my desktop'}
          </button>
        ) : (
          <p className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <Hourglass className="size-4 text-amber-300" />
            Waiting for your teacher to start your desktop.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <InfoTile
          icon={<OsIcon os={os} className="size-4 text-slate-200" />}
          label="Operating system"
          value={os === 'windows' ? 'Windows' : 'Linux'}
        />
        <InfoTile
          icon={<Clock className="size-4 text-amber-300" />}
          label="Session length"
          value={formatDurationLabel(duration)}
        />
        <InfoTile
          icon={<HardDrive className="size-4 text-cyan-300" />}
          label="Your files"
          value={hasFiles ? 'Saved & ready' : 'New volume'}
          hint="Mounted as “My-Files” on the desktop"
        />
        {!usage.unlimited && (
          <InfoTile
            icon={<Clock className="size-4 text-emerald-300" />}
            label="Time left this month"
            value={`${Math.max(0, usage.remaining)} min`}
          />
        )}
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-white/5">{icon}</span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-100">{value}</p>
        {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}
