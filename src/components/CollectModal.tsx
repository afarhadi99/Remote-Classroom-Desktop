"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, RefreshCw, Inbox } from "lucide-react"
import { Spinner } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { initialsOf } from "@/lib/utils"

interface CollectFile {
  name: string
  size: number
  path: string
}
interface CollectStudent {
  machineId: string
  studentName: string
  files: CollectFile[]
}

export function CollectModal({
  classId,
  open,
  onOpenChange,
}: {
  classId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const [folder, setFolder] = useState("Turn-in")
  const [students, setStudents] = useState<CollectStudent[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (f: string) => {
      setLoading(true)
      try {
        const res = await api<{ folder: string; students: CollectStudent[] }>(
          `/api/classes/${classId}/collect?folder=${encodeURIComponent(f)}`,
        )
        setStudents(res.students)
      } catch (e) {
        toast.error("Could not collect", (e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [classId, toast],
  )

  useEffect(() => {
    if (open) load(folder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function download(machineId: string, path: string, name: string) {
    try {
      const res = await fetch(
        `/api/files/download?machineId=${machineId}&path=${encodeURIComponent(path)}`,
      )
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed (${res.status})`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      toast.error("Download failed", (e as Error).message)
    }
  }

  const withWork = students?.filter((s) => s.files.length > 0) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Inbox className="size-5 text-primary" /> Collect work
          </DialogTitle>
          <DialogDescription>
            Files in each running student&apos;s <span className="font-medium">My-Files/{folder}</span> folder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="folder">Submission folder</Label>
            <Input id="folder" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Turn-in" />
          </div>
          <Button variant="outline" onClick={() => load(folder)} disabled={loading}>
            {loading ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />} Refresh
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {!students ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Spinner className="size-5" />
            </div>
          ) : students.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No desktops are running, so there&apos;s nothing to collect yet.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {withWork.length} of {students.length} running student{students.length === 1 ? "" : "s"} submitted
                files.
              </p>
              {students.map((s) => (
                <div key={s.machineId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
                        {initialsOf(s.studentName) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{s.studentName}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.files.length ? `${s.files.length} file${s.files.length === 1 ? "" : "s"}` : "nothing submitted"}
                    </span>
                  </div>
                  {s.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.files.map((f) => (
                        <button
                          key={f.name}
                          onClick={() => download(s.machineId, f.path, f.name)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-foreground transition hover:border-foreground/20"
                        >
                          <Download className="size-3" /> {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
