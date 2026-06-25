'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Maximize2,
  Minimize2,
  ExternalLink,
  Power,
  Clock,
  RotateCw,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { OsIcon, Spinner } from '@/components/ui'
import { formatRemaining } from '@/lib/client'
import { cn } from '@/lib/utils'

export interface ViewerMachine {
  id: string
  os: string
  previewUrl: string | null
  expiresAt: string | null
  studentName?: string | null
}

// seconds-before-expiry -> message
const THRESHOLDS: { at: number; title: string; msg: string }[] = [
  { at: 300, title: '5 minutes left', msg: 'Save your work — your desktop will shut down soon.' },
  { at: 60, title: '1 minute left', msg: 'Your session is about to end. Finish up and save to My-Files.' },
  { at: 30, title: '30 seconds left', msg: 'Wrapping up now. Your files in My-Files are kept safe.' },
]

export function DesktopViewer({
  machine,
  onStop,
  stopping,
  compact = false,
}: {
  machine: ViewerMachine
  onStop?: () => void
  stopping?: boolean
  compact?: boolean
}) {
  const toast = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const firedRef = useRef<Set<number>>(new Set())
  const lastExpiry = useRef<string | null>(null)

  // reset notification state when a new session starts
  useEffect(() => {
    if (machine.expiresAt !== lastExpiry.current) {
      firedRef.current = new Set()
      lastExpiry.current = machine.expiresAt
    }
  }, [machine.expiresAt])

  // request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // ticking countdown + threshold notifications
  useEffect(() => {
    if (!machine.expiresAt) {
      setRemainingMs(null)
      return
    }
    const expiry = new Date(machine.expiresAt).getTime()

    const tick = () => {
      const ms = expiry - Date.now()
      setRemainingMs(ms)
      const secs = Math.floor(ms / 1000)
      for (const t of THRESHOLDS) {
        if (secs <= t.at && secs > t.at - 5 && !firedRef.current.has(t.at)) {
          firedRef.current.add(t.at)
          toast.timer(t.title, t.msg)
          notifyNative(t.title, t.msg)
        }
      }
      if (ms <= 0 && !firedRef.current.has(0)) {
        firedRef.current.add(0)
        toast.warning('Session ended', 'Time is up. Your files are saved in My-Files.')
        notifyNative('Session ended', 'Time is up. Your files are saved.')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [machine.expiresAt, toast])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const low = remainingMs !== null && remainingMs <= 5 * 60_000
  const critical = remainingMs !== null && remainingMs <= 60_000

  return (
    <div
      ref={containerRef}
      className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/40"
    >
      {/* control bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c1120]/90 px-3 py-2">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/5">
            <OsIcon os={machine.os} className="size-4 text-slate-200" />
          </span>
          <span className="text-sm font-medium">
            {machine.os === 'windows' ? 'Windows' : 'Linux'} desktop
            {machine.studentName ? (
              <span className="text-slate-500"> · {machine.studentName}</span>
            ) : null}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {remainingMs !== null && (
            <span
              className={cn(
                'chip border tabular-nums',
                critical
                  ? 'border-red-500/40 bg-red-500/15 text-red-200'
                  : low
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                    : 'border-white/10 bg-white/5 text-slate-300',
              )}
              title="Time remaining before auto-shutdown"
            >
              <Clock className="size-3.5" />
              {formatRemaining(remainingMs)}
            </span>
          )}
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="btn-ghost btn-sm"
            title="Reconnect"
          >
            <RotateCw className="size-3.5" />
          </button>
          {machine.previewUrl && (
            <a
              href={machine.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost btn-sm"
              title="Open in new tab"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button onClick={toggleFullscreen} className="btn-ghost btn-sm" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          {onStop && (
            <button onClick={onStop} disabled={stopping} className="btn-danger btn-sm">
              {stopping ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />}
              {stopping ? 'Stopping' : 'Shut down'}
            </button>
          )}
        </div>
      </div>

      {/* desktop iframe */}
      <div className={cn('relative w-full bg-black', compact ? 'aspect-video' : 'h-[72vh]')}>
        {machine.previewUrl ? (
          <iframe
            key={iframeKey}
            src={machine.previewUrl}
            className="absolute inset-0 size-full"
            allow="clipboard-read; clipboard-write; fullscreen"
            title="Cloud desktop"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-500">
            No active desktop
          </div>
        )}
      </div>
    </div>
  )
}

function notifyNative(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    /* ignore */
  }
}
