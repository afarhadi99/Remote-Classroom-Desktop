"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2, ExternalLink, Power, Clock, RotateCw, Wifi, WifiLow } from "lucide-react"
import { useToast } from "@/components/Toast"
import { OsIcon, Spinner } from "@/components/brand"
import { api, formatRemaining } from "@/lib/client"
import { cn } from "@/lib/utils"

// Build the noVNC iframe URL. ALWAYS uses resize=scale so the remote desktop is scaled to
// fit the viewport (embedded or fullscreen) and is never clipped/cut off. Connection-saver
// additionally lowers quality + compression for weak Wi-Fi.
function buildDesktopSrc(url: string, saver: boolean): string {
  try {
    const qIdx = url.indexOf("?")
    if (qIdx === -1) return url
    const sp = new URLSearchParams(url.slice(qIdx + 1))
    sp.set("resize", "scale") // fit-to-screen, no clipping
    if (saver) {
      sp.set("quality", "2")
      sp.set("compression", "9")
    }
    return `${url.slice(0, qIdx)}?${sp.toString()}`
  } catch {
    return url
  }
}

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
  watchMachineId,
  connectionSaver,
  autoFullscreen,
}: {
  machine: ViewerMachine
  onStop?: () => void
  stopping?: boolean
  compact?: boolean
  /** When set (teacher views), heartbeats so the student sees a "being watched" banner. */
  watchMachineId?: string
  /** Student low-bandwidth mode: initial value enables a toggle that persists the pref. */
  connectionSaver?: boolean
  /** Auto-enter fullscreen once the desktop is live (student view). */
  autoFullscreen?: boolean
}) {
  const toast = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [saver, setSaver] = useState(!!connectionSaver)
  const showSaverToggle = connectionSaver !== undefined // only in the student's own viewer
  const triedFsRef = useRef(false)
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

  // Auto-enter fullscreen the moment the student's desktop is live. Browsers require a
  // transient user activation; if it's blocked, fall back to entering on the next click/tap.
  useEffect(() => {
    if (!autoFullscreen || !machine.previewUrl || triedFsRef.current) return
    triedFsRef.current = true
    const enter = () => containerRef.current?.requestFullscreen?.().catch(() => false)
    Promise.resolve(enter()).then((ok) => {
      if (ok === false) {
        const once = () => {
          containerRef.current?.requestFullscreen?.().catch(() => {})
          document.removeEventListener("pointerdown", once)
        }
        document.addEventListener("pointerdown", once, { once: true })
      }
    })
  }, [autoFullscreen, machine.previewUrl])

  // Teacher "watching" heartbeat -> student sees a transparency banner.
  useEffect(() => {
    if (!watchMachineId) return
    const ping = () => {
      fetch(`/api/machines/${watchMachineId}/watch`, { method: "POST" }).catch(() => {})
    }
    ping()
    const t = setInterval(ping, 15_000)
    return () => clearInterval(t)
  }, [watchMachineId])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const toggleSaver = () => {
    const next = !saver
    setSaver(next)
    setIframeKey((k) => k + 1) // remount the iframe with the new streaming params
    api("/api/student/prefs", { method: "PATCH", body: { connectionSaver: next } }).catch(() => {})
    toast.info(
      next ? "Connection saver on" : "Connection saver off",
      next ? "Lower quality for weak Wi-Fi — no reboot needed." : "Back to full quality.",
    )
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
          {showSaverToggle && (
            <button
              onClick={toggleSaver}
              className={cn(ctlBtn, saver && "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30")}
              title={saver ? "Connection saver ON (low bandwidth)" : "Turn on connection saver (low bandwidth)"}
            >
              {saver ? <WifiLow className="size-3.5" /> : <Wifi className="size-3.5" />}
              <span className="hidden sm:inline">{saver ? "Saver on" : "Saver"}</span>
            </button>
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
            src={buildDesktopSrc(machine.previewUrl, saver)}
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
