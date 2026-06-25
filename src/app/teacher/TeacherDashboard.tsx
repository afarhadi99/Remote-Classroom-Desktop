'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Users, MonitorPlay, ArrowRight, X, Sparkles, Lock } from 'lucide-react'
import { Spinner, OsIcon } from '@/components/ui'
import { CopyButton } from '@/components/CopyButton'
import { OsPicker, DurationPicker } from '@/components/Pickers'
import { useToast } from '@/components/Toast'
import { api, formatDurationLabel } from '@/lib/client'
import type { OsType } from '@/lib/os'

interface ClassSummary {
  id: string
  name: string
  joinCode: string
  defaultOs: OsType
  defaultDurationMin: number
  allowStudentBoot: boolean
  studentCount: number
  activeMachines: number
  createdAt: string
}

interface Account {
  plan: {
    id: 'free' | 'pro'
    name: string
    maxClasses: number
    maxClassesUnlimited: boolean
    maxSessionMinutes: number
  }
  classCount: number
}

export function TeacherDashboard({ teacherName }: { teacherName: string }) {
  const toast = useToast()
  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    try {
      const [{ classes }, acct] = await Promise.all([
        api<{ classes: ClassSummary[] }>('/api/classes'),
        api<Account>('/api/teacher/account'),
      ])
      setClasses(classes)
      setAccount(acct)
    } catch (err) {
      toast.error('Could not load classes', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const plan = account?.plan
  const atClassLimit = !!plan && !plan.maxClassesUnlimited && classes.length >= plan.maxClasses

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome, {teacherName.split(' ')[0]}
            </h1>
            {plan && (
              <Link
                href="/teacher/billing"
                className={
                  plan.id === 'pro'
                    ? 'chip border border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
                    : 'chip border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }
              >
                {plan.id === 'pro' && <Sparkles className="size-3" />}
                {plan.name} plan
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Create a class, share the code, and give every student a cloud desktop.
          </p>
        </div>
        {atClassLimit ? (
          <Link href="/teacher/billing" className="btn-primary">
            <Sparkles className="size-4" /> Upgrade for more classes
          </Link>
        ) : (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="size-4" /> New class
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center text-slate-500">
          <Spinner className="size-6" />
        </div>
      ) : classes.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} onDeleted={load} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClassModal
          maxMinutes={plan?.maxSessionMinutes ?? 45}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </main>
  )
}

function ClassCard({ c, onDeleted }: { c: ClassSummary; onDeleted: () => void }) {
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    if (!confirm(`Delete "${c.name}"? This shuts down all its desktops and removes students.`)) return
    setDeleting(true)
    try {
      await api(`/api/classes/${c.id}`, { method: 'DELETE' })
      toast.success('Class deleted')
      onDeleted()
    } catch (err) {
      toast.error('Could not delete', (err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className="card group flex flex-col p-5 transition hover:border-white/20">
      <div className="flex items-start justify-between">
        <Link href={`/teacher/class/${c.id}`} className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-100 group-hover:text-white">
            {c.name}
          </h3>
        </Link>
        <button
          onClick={remove}
          disabled={deleting}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
          title="Delete class"
        >
          {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-sm tracking-wider text-indigo-200">
          {c.joinCode}
        </code>
        <CopyButton value={c.joinCode} label="Code" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="chip border border-white/10 bg-white/5 text-slate-300">
          <OsIcon os={c.defaultOs} className="size-3.5" />
          {c.defaultOs === 'windows' ? 'Windows' : 'Linux'}
        </span>
        <span className="chip border border-white/10 bg-white/5 text-slate-300">
          {formatDurationLabel(c.defaultDurationMin)}
        </span>
        <span className="chip border border-white/10 bg-white/5 text-slate-300">
          <Users className="size-3.5" /> {c.studentCount}
        </span>
        {c.activeMachines > 0 && (
          <span className="chip border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
            <MonitorPlay className="size-3.5" /> {c.activeMachines} live
          </span>
        )}
      </div>

      <Link
        href={`/teacher/class/${c.id}`}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        Manage class <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card mt-10 flex flex-col items-center px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-white">
        <Plus className="size-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-100">Create your first class</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-400">
        Name it, pick an operating system and a time limit, and we&apos;ll generate a join code for
        your students.
      </p>
      <button onClick={onCreate} className="btn-primary mt-6">
        <Plus className="size-4" /> New class
      </button>
    </div>
  )
}

function CreateClassModal({
  onClose,
  onCreated,
  maxMinutes,
}: {
  onClose: () => void
  onCreated: () => void
  maxMinutes: number
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [os, setOs] = useState<OsType>('linux')
  const [duration, setDuration] = useState(Math.min(60, maxMinutes))
  const [allowStudentBoot, setAllowStudentBoot] = useState(true)
  const [saving, setSaving] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/api/classes', {
        body: { name, defaultOs: os, defaultDurationMin: duration, allowStudentBoot },
      })
      toast.success('Class created', 'Share the join code with your students.')
      onCreated()
    } catch (err) {
      toast.error('Could not create class', (err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">New class</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={create} className="mt-5 space-y-5">
          <div>
            <label className="label">Class name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 3 — Intro to Linux"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Operating system</label>
            <OsPicker value={os} onChange={setOs} />
          </div>

          <div>
            <label className="label">Time limit per desktop</label>
            <DurationPicker value={duration} onChange={setDuration} maxMinutes={maxMinutes} />
            {maxMinutes < 120 && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="size-3" /> Longer sessions are available on Pro.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <input
              type="checkbox"
              checked={allowStudentBoot}
              onChange={(e) => setAllowStudentBoot(e.target.checked)}
              className="size-4 accent-indigo-500"
            />
            <span className="text-sm text-slate-300">
              Let students boot their own desktop
              <span className="block text-xs text-slate-500">
                If off, only you can start their machines.
              </span>
            </span>
          </label>

          <button type="submit" disabled={saving || !name} className="btn-primary w-full">
            {saving && <Spinner />} Create class
          </button>
        </form>
      </div>
    </div>
  )
}
