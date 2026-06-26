"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize2, X, MonitorOff } from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DesktopViewer } from "@/components/DesktopViewer"
import { useToast } from "@/components/Toast"
import { api, formatRemaining } from "@/lib/client"
import { initialsOf, cn } from "@/lib/utils"

interface RunningMachine {
  id: string
  studentId: string | null
  studentName: string | null
  os: string
  status: string
  tileUrl: string | null
  previewUrl: string | null
  expiresAt: string | null
  remainingMs: number | null
}

export function MonitorWall({ classId }: { classId: string }) {
  const toast = useToast()
  const [machines, setMachines] = useState<RunningMachine[] | null>(null)
  const [expanded, setExpanded] = useState<RunningMachine | null>(null)

  const load = useCallback(async () => {
    try {
      const { machines } = await api<{ machines: RunningMachine[] }>(
        `/api/classes/${classId}/machines/running`,
      )
      setMachines(machines)
      setExpanded((cur) => (cur ? machines.find((m) => m.id === cur.id) ?? null : null))
    } catch (e) {
      toast.error("Could not load desktops", (e as Error).message)
    }
  }, [classId, toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  if (!machines) {
    return (
      <div className="mt-4 flex justify-center py-16 text-muted-foreground">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (machines.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <MonitorOff className="size-6" />
        </div>
        <p className="mt-4 font-medium text-foreground">No desktops are running</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Boot the class or have students start their desktops, then watch them here live.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {machines.map((m) => (
          <Tile key={m.id} m={m} onExpand={() => m.previewUrl && setExpanded(m)} />
        ))}
      </div>

      {expanded && expanded.previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/80 p-4 backdrop-blur-sm sm:p-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between pb-3">
            <h3 className="font-display text-xl text-background">
              {expanded.studentName}&apos;s desktop
            </h3>
            <Button variant="secondary" size="sm" onClick={() => setExpanded(null)}>
              <X className="size-4" /> Close
            </Button>
          </div>
          <div className="mx-auto w-full max-w-6xl">
            <DesktopViewer
              machine={{
                id: expanded.id,
                os: expanded.os,
                previewUrl: expanded.previewUrl,
                expiresAt: expanded.expiresAt,
                studentName: expanded.studentName,
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function Tile({ m, onExpand }: { m: RunningMachine; onExpand: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // Only mount the live iframe when the tile is on screen (caps concurrent streams).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const booting = m.status === "PROVISIONING"
  const running = m.status === "RUNNING" && !!m.tileUrl
  const live = running && visible // only open a VNC socket once the tile is on screen

  return (
    <div
      ref={ref}
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Avatar className="size-6">
          <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
            {initialsOf(m.studentName ?? "?") || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {m.studentName ?? "Student"}
        </span>
        <OsIcon os={m.os} className="size-3.5 text-muted-foreground" />
      </div>

      <button
        onClick={onExpand}
        className="relative block aspect-[3/2] w-full cursor-pointer bg-zinc-950"
        title="Click to expand"
      >
        {booting ? (
          <span className="absolute inset-0 grid place-items-center text-zinc-400">
            <span className="flex flex-col items-center gap-2">
              <Spinner className="size-5" />
              <span className="text-xs">Booting…</span>
            </span>
          </span>
        ) : live ? (
          <>
            <iframe
              src={m.tileUrl!}
              tabIndex={-1}
              className="pointer-events-none absolute inset-0 size-full"
              title={`${m.studentName ?? "Student"} desktop`}
            />
            {/* click-catcher overlay so the tile click expands rather than focusing the iframe */}
            <span className="absolute inset-0" />
            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <Maximize2 className="size-3.5" />
            </span>
          </>
        ) : running ? (
          <span className="absolute inset-0 grid place-items-center text-xs text-zinc-500">
            Live preview — scroll to load
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {m.os === "windows" ? "Windows — click to open" : "Click to open"}
          </span>
        )}
      </button>

      <div className="flex items-center justify-between px-3 py-2">
        <StatusBadge status={m.status} />
        {m.remainingMs != null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatRemaining(m.remainingMs)}
          </span>
        )}
      </div>
    </div>
  )
}
