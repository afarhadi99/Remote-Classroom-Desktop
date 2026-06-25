import Link from 'next/link'
import { MonitorPlay, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5', className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
        <MonitorPlay className="size-5 text-white" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-100">
        Remote Classroom<span className="text-indigo-400"> Desktop</span>
      </span>
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-rcd-spin', className)} />
}

const STATUS_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  RUNNING: { label: 'Running', cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  PROVISIONING: { label: 'Booting…', cls: 'bg-amber-500/12 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
  STOPPING: { label: 'Stopping…', cls: 'bg-slate-500/12 text-slate-300 border-slate-500/25', dot: 'bg-slate-400' },
  STOPPED: { label: 'Stopped', cls: 'bg-slate-500/12 text-slate-300 border-slate-500/25', dot: 'bg-slate-500' },
  EXPIRED: { label: 'Time up', cls: 'bg-orange-500/12 text-orange-300 border-orange-500/25', dot: 'bg-orange-400' },
  ERROR: { label: 'Error', cls: 'bg-red-500/12 text-red-300 border-red-500/25', dot: 'bg-red-400' },
  PENDING: { label: 'Idle', cls: 'bg-slate-500/12 text-slate-300 border-slate-500/25', dot: 'bg-slate-500' },
  NONE: { label: 'Not started', cls: 'bg-slate-500/10 text-slate-400 border-white/10', dot: 'bg-slate-600' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.NONE
  const animating = status === 'PROVISIONING' || status === 'STOPPING'
  return (
    <span className={cn('chip border', s.cls)}>
      <span className={cn('size-1.5 rounded-full', s.dot, animating && 'animate-pulse')} />
      {s.label}
    </span>
  )
}

export function OsIcon({ os, className }: { os: string; className?: string }) {
  if (os === 'windows') {
    return (
      <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="currentColor" aria-hidden>
        <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.5 1.2L21 21V12.5h-9.5v7.2Zm0-15.4v7.2H21V3l-9.5 1.3Z" />
      </svg>
    )
  }
  // linux (Tux-ish glyph)
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="currentColor" aria-hidden>
      <path d="M12 2c-2.2 0-3.6 1.8-3.6 4.2 0 1.5-.5 2.4-1.4 3.6C5.7 11.6 5 13 5 14.7c0 .9-.5 1.6-1 2.4-.5.8-.4 1.7.4 2.1.6.3 1.3.1 2 .4.8.3 1.1 1.3 2.2 1.6 1 .3 2-.2 3-.2s2 .5 3 .2c1.1-.3 1.4-1.3 2.2-1.6.7-.3 1.4-.1 2-.4.8-.4.9-1.3.4-2.1-.5-.8-1-1.5-1-2.4 0-1.7-.7-3.1-2-4.9-.9-1.2-1.4-2.1-1.4-3.6C15.6 3.8 14.2 2 12 2Zm-1.6 4c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm3.2 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm-1.6 2.7c.7 0 1.6.5 1.6 1 0 .3-.9.7-1.6.7s-1.6-.4-1.6-.7c0-.5.9-1 1.6-1Z" />
    </svg>
  )
}
