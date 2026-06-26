"use client"

import { FolderOpen } from "lucide-react"
import { FileBrowser } from "@/components/FileBrowser"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export function FilesModal({
  machineId,
  studentName,
  open,
  onOpenChange,
}: {
  machineId: string | null
  studentName?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <FolderOpen className="size-5 text-primary" />
            {studentName ? `${studentName}'s files` : "My files"}
          </DialogTitle>
          <DialogDescription>
            Everything in the persistent <span className="font-medium">My-Files</span> volume.
            Files stay here even after the desktop shuts down.
          </DialogDescription>
        </DialogHeader>
        {machineId && <FileBrowser machineId={machineId} />}
      </DialogContent>
    </Dialog>
  )
}
