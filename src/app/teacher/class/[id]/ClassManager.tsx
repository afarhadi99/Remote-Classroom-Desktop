'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { Spinner, StatusBadge, OsIcon } from '@/components/ui'
import { CopyButton } from '@/components/CopyButton'
import { OsPicker, DurationPicker } from '@/components/Pickers'
import { DesktopViewer } from '@/components/DesktopViewer'
import { useToast } from '@/components/Toast'
import { api, formatRemaining, formatDurationLabel } from '@/lib/client'
import { initialsOf } from '@/lib/utils'
import type { OsType } from '@/lib/os'

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
}
interface SClassroom {
  id: string
  name: string
  joinCode: string
  defaultOs: OsType
  defaultDurationMin: number
  allowStudentBoot: boolean
}
interface ClassData {
  classroom: SClassroom
  students: SStudent[]
  machines: SMachine[]
}

const ACTIVE = ['PROVISIONING', 'RUNNING']

export function ClassManager({ classId }: { classId: string }) {
  const toast = useToast()
  const [data, setData] = useState<ClassData | null>(null)
  const [os, setOs] = useState<OsType>('linux')
  const [duration, setDuration] = useState(60)
  const [settingsTouched, setSettingsTouched] = useState(false)
  const [bootingAll, setBootingAll] = useState(false)
  const [stoppingAll, setStoppingAll] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const initialized = useRef(false)

  const load = useCallback(async () => {
    try {
      const d = await api<ClassData>(`/api/classes/${classId}`)
      setData(d)
      if (!initialized.current) {
        setOs(d.classroom.defaultOs)
        setDuration(d.classroom.defaultDurationMin)
        initialized.current = true
      }
    } catch (err) {
      toast.error('Could not load class', (err as Error).message)
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
        method: 'PATCH',
        body: { defaultOs: os, defaultDurationMin: duration },
      })
      setSettingsTouched(false)
      toast.success('Settings saved')
      load()
    } catch (err) {
      toast.error('Could not save', (err as Error).message)
    } finally {
      setSavingSettings(false)
    }
  }

  async function bootAll() {
    setBootingAll(true)
    try {
      await api(`/api/classes/${classId}`, {
        method: 'PATCH',
        body: { defaultOs: os, defaultDurationMin: duration },
      })
      const res = await api<{ booted: number }>(`/api/classes/${classId}/provision`, {
        body: { os, durationMin: duration },
      })
      toast.success(`Booting ${res.booted} desktop${res.booted === 1 ? '' : 's'}`, 'This takes a few seconds per machine.')
      setSettingsTouched(false)
      load()
    } catch (err) {
      toast.error('Could not boot desktops', (err as Error).message)
    } finally {
      setBootingAll(false)
    }
  }

  async function stopAll() {
    if (!confirm('Shut down every running desktop in this class?')) return
    setStoppingAll(true)
    try {
      const res = await api<{ stopped: number }>(`/api/classes/${classId}/stop-all`, { method: 'POST' })
      toast.success(`Shut down ${res.stopped} desktop${res.stopped === 1 ? '' : 's'}`)
      setSelectedId(null)
      load()
    } catch (err) {
      toast.error('Could not shut down', (err as Error).message)
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
      toast.error('Could not boot', (err as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [studentId]: false }))
    }
  }

  async function stopMachine(machineId: string, studentId: string) {
    setBusy((b) => ({ ...b, [studentId]: true }))
    try {
      await api(`/api/machines/${machineId}/stop`, { method: 'POST' })
      if (selectedId === machineId) setSelectedId(null)
      load()
    } catch (err) {
      toast.error('Could not stop', (err as Error).message)
    } finally {
      setBusy((b) => ({ ...b, [studentId]: false }))
    }
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 justify-center px-5 py-20 text-slate-500">
        <Spinner className="size-6" />
      </main>
    )
  }

  const { classroom, students } = data
  const activeCount = students.filter((s) => s.machine && ACTIVE.includes(s.machine.status)).length
  const selectedMachine =
    selectedId != null
      ? students.map((s) => s.machine).find((m) => m && m.id === selectedId) ?? null
      : null

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="size-4" /> All classes
      </Link>

      {/* selected desktop viewer */}
      {selectedMachine && selectedMachine.status === 'RUNNING' && selectedMachine.previewUrl ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Watching {selectedMachine.studentName}&apos;s desktop
            </h2>
            <button onClick={() => setSelectedId(null)} className="btn-ghost btn-sm">
              <ArrowLeft className="size-3.5" /> Back to class
            </button>
          </div>
          <DesktopViewer
            machine={selectedMachine}
            onStop={() => stopMachine(selectedMachine.id, selectedMachine.studentId!)}
            stopping={busy[selectedMachine.studentId!]}
          />
        </div>
      ) : (
        <>
          <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{classroom.name}</h1>
              <p className="mt-1 flex items-center gap-3 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> {students.length} student{students.length === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="size-4" /> {activeCount} live
                </span>
              </p>
            </div>
          </header>

          {/* join code panel */}
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="card flex flex-col justify-between p-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Share2 className="size-4 text-indigo-400" /> Class join code
                </p>
                <p className="mt-3 font-mono text-3xl font-bold tracking-[0.2em] text-white">
                  {classroom.joinCode}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Students go to the home page → “Join a class” → enter this code and their name.
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <CopyButton value={classroom.joinCode} label="Copy code" />
                <CopyButton
                  value={`Join our class on Remote Classroom Desktop. Code: ${classroom.joinCode}`}
                  label="Copy invite"
                />
              </div>
            </div>

            {/* controls */}
            <div className="card p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Settings2 className="size-4 text-indigo-400" /> Desktop settings
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Operating system</label>
                  <OsPicker
                    value={os}
                    onChange={(v) => {
                      setOs(v)
                      setSettingsTouched(true)
                    }}
                  />
                </div>
                <div>
                  <label className="label">Time limit</label>
                  <DurationPicker
                    value={duration}
                    onChange={(v) => {
                      setDuration(v)
                      setSettingsTouched(true)
                    }}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    Desktops auto-shut down after {formatDurationLabel(duration)}. Students are
                    warned at 5 min, 1 min and 30 sec.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={bootAll} disabled={bootingAll || students.length === 0} className="btn-primary">
                  {bootingAll ? <Spinner /> : <Rocket className="size-4" />} Boot all desktops
                </button>
                <button onClick={stopAll} disabled={stoppingAll || activeCount === 0} className="btn-danger">
                  {stoppingAll ? <Spinner /> : <Power className="size-4" />} Shut down all
                </button>
                {settingsTouched && (
                  <button onClick={saveSettings} disabled={savingSettings} className="btn-ghost">
                    {savingSettings ? <Spinner /> : <Settings2 className="size-4" />} Save as default
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* students */}
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Students
          </h2>
          {students.length === 0 ? (
            <div className="card mt-3 px-6 py-12 text-center text-slate-400">
              No students yet. Share the join code <span className="font-mono text-indigo-300">{classroom.joinCode}</span> to get started.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <StudentCard
                  key={s.id}
                  student={s}
                  busy={!!busy[s.id]}
                  onBoot={() => bootStudent(s.id)}
                  onStop={(mid) => stopMachine(mid, s.id)}
                  onOpen={(mid) => setSelectedId(mid)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}

function StudentCard({
  student,
  busy,
  onBoot,
  onStop,
  onOpen,
}: {
  student: SStudent
  busy: boolean
  onBoot: () => void
  onStop: (machineId: string) => void
  onOpen: (machineId: string) => void
}) {
  const m = student.machine
  const isActive = m && ACTIVE.includes(m.status)
  const isRunning = m?.status === 'RUNNING'

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-semibold text-white">
          {initialsOf(student.name) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{student.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <StatusBadge status={m?.status ?? 'NONE'} />
            {isRunning && m?.remainingMs != null && (
              <span className="text-xs tabular-nums text-slate-400">{formatRemaining(m.remainingMs)}</span>
            )}
          </div>
        </div>
        {m && (
          <span title={m.os}>
            <OsIcon os={m.os} className="size-4 text-slate-400" />
          </span>
        )}
      </div>

      {m?.status === 'ERROR' && m.errorMessage && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {m.errorMessage}
        </p>
      )}

      <div className="mt-auto flex gap-2">
        {isRunning && m?.previewUrl ? (
          <>
            <button onClick={() => onOpen(m.id)} className="btn-primary btn-sm flex-1">
              <Monitor className="size-3.5" /> Watch
            </button>
            <button onClick={() => onStop(m.id)} disabled={busy} className="btn-danger btn-sm">
              {busy ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />}
            </button>
          </>
        ) : isActive ? (
          <button disabled className="btn-ghost btn-sm flex-1">
            <Spinner className="size-3.5" /> Booting…
          </button>
        ) : (
          <button onClick={onBoot} disabled={busy} className="btn-ghost btn-sm flex-1">
            {busy ? <Spinner className="size-3.5" /> : <PlayCircle className="size-3.5" />} Boot desktop
          </button>
        )}
      </div>
    </div>
  )
}
