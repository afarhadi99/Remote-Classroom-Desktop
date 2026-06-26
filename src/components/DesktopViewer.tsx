"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2, ExternalLink, Power, Clock, RotateCw } from "lucide-react"
import { useToast } from "@/components/Toast"
import { OsIcon, Spinner } from "@/components/brand"
import { formatRemaining } from "@/lib/client"
import { cn } from "@/lib/utils"

export interface ViewerMachine {
  id: string
  os: string
  previewUrl: string | null
  expiresAt: string | null
  studentName?: string | null
}

const THRESHOLDS: { at: number; title: string; msg: string }[] = [
  { at: 300, title: "5 minutes left", msg: "Save your work — your desktop will shut down soon." },
  { at: 60, title: "1 minute left", msg: "Your session is about to end. Finish up and save to My-Files." },
  { at: 30, title: "30 seconds left", msg: "Wrapping up now. Your files in My-Files are kept safe." },
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

  useEffect(() => {
    if (machine.expiresAt !== lastExpiry.current) {
      firedRef.current = new Set()
      lastExpiry.current = machine.expiresAt
    }
  }, [machine.expiresAt])

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

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
        toast.warning("Session ended", "Time is up. Your files are saved in My-Files.")
        notifyNative("Session ended", "Time is up. Your files are saved.")
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [machine.expiresAt, toast])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const low = remainingMs !== null && remainingMs <= 5 * 60_000
  const critical = remainingMs !== null && remainingMs <= 60_000

  const ctlBtn =
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl"
    >
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2 text-zinc-200">
          <span className="grid size-6 place-items-center rounded-md bg-white/5">
            <OsIcon os={machine.os} className="size-3.5 text-zinc-200" />
          </span>
          <span className="text-sm font-medium">
            {machine.os === "windows" ? "Windows" : "Linux"} desktop
            {machine.studentName ? <span className="text-zinc-500"> · {machine.studentName}</span> : null}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {remainingMs !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums",
                critical
                  ? "bg-red-500/20 text-red-300"
                  : low
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/5 text-zinc-300",
              )}
              title="Time remaining before auto-shutdown"
            >
              <Clock className="size-3.5" />
              {formatRemaining(remainingMs)}
            </span>
          )}
          <button onClick={() => setIframeKey((k) => k + 1)} className={ctlBtn} title="Reconnect">
            <RotateCw className="size-3.5" />
          </button>
          {machine.previewUrl && (
            <a href={machine.previewUrl} target="_blank" rel="noreferrer" className={ctlBtn} title="Open in new tab">
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button onClick={toggleFullscreen} className={ctlBtn} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          {onStop && (
            <button
              onClick={onStop}
              disabled={stopping}
              className="ml-1 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-red-500/15 px-2.5 text-xs font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              {stopping ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />}
              {stopping ? "Stopping" : "Shut down"}
            </button>
          )}
        </div>
      </div>

      {/* desktop */}
      <div className={cn("relative w-full bg-black", compact ? "aspect-video" : "h-[72vh]")}>
        {machine.previewUrl ? (
          <iframe
            key={iframeKey}
            src={machine.previewUrl}
            className="absolute inset-0 size-full"
            allow="clipboard-read; clipboard-write; fullscreen"
            title="Cloud desktop"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-zinc-500">No active desktop</div>
        )}
      </div>
    </div>
  )
}

function notifyNative(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body })
    }
  } catch {
    /* ignore */
  }
}
