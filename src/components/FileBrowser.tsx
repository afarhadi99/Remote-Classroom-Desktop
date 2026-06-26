"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Folder,
  FileText,
  Download,
  ChevronRight,
  CornerLeftUp,
  RefreshCw,
  HardDrive,
  AlertTriangle,
} from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { MY_FILES_PATH } from "@/lib/os"
import { cn } from "@/lib/utils"

interface FileEntry {
  name: string
  isDir: boolean
  size: number
  modified: string | null
}
interface ListResponse {
  path: string
  atRoot: boolean
  files: FileEntry[]
}

function humanSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function FileBrowser({ machineId }: { machineId: string }) {
  const toast = useToast()
  const [path, setPath] = useState(MY_FILES_PATH)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reqRef = useRef(0)

  const load = useCallback(
    async (p: string) => {
      const myReq = ++reqRef.current // latest-wins: ignore stale responses
      setLoading(true)
      setError(null)
      try {
        const res = await api<ListResponse>(
          `/api/files/list?machineId=${machineId}&path=${encodeURIComponent(p)}`,
        )
        if (myReq !== reqRef.current) return
        setData(res)
        setPath(res.path)
      } catch (e) {
        if (myReq !== reqRef.current) return
        setError((e as Error).message)
        setData(null)
      } finally {
        if (myReq === reqRef.current) setLoading(false)
      }
    },
    [machineId],
  )

  useEffect(() => {
    load(MY_FILES_PATH)
  }, [load])

  // breadcrumb segments below the mount root
  const rel = path.startsWith(MY_FILES_PATH) ? path.slice(MY_FILES_PATH.length).replace(/^\//, "") : ""
  const segments = rel ? rel.split("/") : []
  const crumbPath = (i: number) => MY_FILES_PATH + "/" + segments.slice(0, i + 1).join("/")
  const parent = path.slice(0, path.lastIndexOf("/")) || MY_FILES_PATH

  async function downloadFile(name: string) {
    const full = `${path}/${name}`
    try {
      const res = await fetch(
        `/api/files/download?machineId=${machineId}&path=${encodeURIComponent(full)}`,
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      toast.error("Could not download", (e as Error).message)
    }
  }

  return (
    <div className="flex h-[60vh] flex-col">
      {/* breadcrumb */}
      <div className="flex items-center gap-1 border-b border-border pb-3 text-sm">
        <button
          onClick={() => load(MY_FILES_PATH)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground transition hover:bg-muted"
        >
          <HardDrive className="size-3.5 text-primary" /> My-Files
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1 text-muted-foreground">
            <ChevronRight className="size-3.5" />
            <button
              onClick={() => load(crumbPath(i))}
              className="cursor-pointer rounded-md px-1.5 py-1 text-foreground transition hover:bg-muted"
            >
              {seg}
            </button>
          </span>
        ))}
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => load(path)} title="Refresh">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* listing */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-6 text-amber-500" />
            {error}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {!data?.atRoot && (
              <button
                onClick={() => load(parent)}
                className="flex w-full cursor-pointer items-center gap-3 px-2 py-2.5 text-left text-sm transition hover:bg-muted"
              >
                <CornerLeftUp className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">..</span>
              </button>
            )}
            {data?.files.length === 0 && (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">
                This folder is empty.
              </div>
            )}
            {data?.files.map((f) =>
              f.isDir ? (
                <button
                  key={f.name}
                  onClick={() => load(`${path}/${f.name}`)}
                  className="flex w-full cursor-pointer items-center gap-3 px-2 py-2.5 text-left text-sm transition hover:bg-muted"
                >
                  <Folder className="size-4 shrink-0 fill-primary/15 text-primary" />
                  <span className="flex-1 truncate font-medium text-foreground">{f.name}</span>
                  <span className="text-xs text-muted-foreground">folder</span>
                </button>
              ) : (
                <div
                  key={f.name}
                  className="group flex items-center gap-3 px-2 py-2.5 text-sm transition hover:bg-muted"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{f.name}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{humanSize(f.size)}</span>
                  <span className="hidden w-36 text-right text-xs text-muted-foreground sm:block">
                    {f.modified ? new Date(f.modified).toLocaleString() : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => downloadFile(f.name)}
                    title="Download"
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
