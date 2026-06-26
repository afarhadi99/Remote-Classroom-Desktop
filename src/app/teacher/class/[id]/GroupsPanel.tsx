"use client"

import { useState } from "react"
import { UsersRound, Plus, Rocket, Power, Monitor, Trash2, Pencil, FolderOpen } from "lucide-react"
import { Spinner, StatusBadge, OsIcon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/Toast"
import { api, formatRemaining } from "@/lib/client"
import { cn } from "@/lib/utils"

interface GMachine {
  id: string
  os: string
  status: string
  previewUrl: string | null
  remainingMs: number | null
}
interface Group {
  id: string
  name: string
  students: { id: string; name: string }[]
  machine: GMachine | null
}
interface RosterStudent {
  id: string
  name: string
  groupId: string | null
}

const ACTIVE = ["PROVISIONING", "RUNNING"]

export function GroupsPanel({
  classId,
  groups,
  students,
  onChange,
  onWatch,
  onFiles,
}: {
  classId: string
  groups: Group[]
  students: RosterStudent[]
  onChange: () => void
  onWatch: (machineId: string) => void
  onFiles: (machineId: string, name: string) => void
}) {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Group | null>(null)

  const setB = (id: string, v: boolean) => setBusy((b) => ({ ...b, [id]: v }))

  async function createGroup() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await api(`/api/classes/${classId}/groups`, { body: { name } })
      setNewName("")
      onChange()
    } catch (e) {
      toast.error("Could not create group", (e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function bootGroup(g: Group) {
    setB(g.id, true)
    try {
      await api(`/api/classes/${classId}/groups/${g.id}/boot`, { method: "POST" })
      toast.success(`Starting ${g.name}'s desktop`, "Every member can open the same machine.")
      onChange()
    } catch (e) {
      toast.error("Could not start desktop", (e as Error).message)
    } finally {
      setB(g.id, false)
    }
  }

  async function stopGroup(g: Group) {
    if (!g.machine) return
    setB(g.id, true)
    try {
      await api(`/api/machines/${g.machine.id}/stop`, { method: "POST" })
      onChange()
    } catch (e) {
      toast.error("Could not stop desktop", (e as Error).message)
    } finally {
      setB(g.id, false)
    }
  }

  async function deleteGroup(g: Group) {
    if (!confirm(`Delete group "${g.name}"? Its shared desktop is shut down and members are unassigned.`)) return
    setB(g.id, true)
    try {
      await api(`/api/classes/${classId}/groups/${g.id}`, { method: "DELETE" })
      onChange()
    } catch (e) {
      toast.error("Could not delete group", (e as Error).message)
      setB(g.id, false)
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Group workstations</h2>
          <p className="text-sm text-muted-foreground">
            Several students share one desktop and one set of files — great for pair programming and
            group projects.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="gname" className="text-xs">New group</Label>
            <Input
              id="gname"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              placeholder="Team Rocket"
              className="w-44"
            />
          </div>
          <Button variant="ink" onClick={createGroup} disabled={creating || !newName.trim()}>
            {creating ? <Spinner className="size-4" /> : <Plus className="size-4" />} Add group
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="mt-4 items-center py-12 text-center text-muted-foreground">
          <UsersRound className="size-7 text-muted-foreground/60" />
          <p className="mt-2">No groups yet. Create one above, then add students to it.</p>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const m = g.machine
            const isRunning = m?.status === "RUNNING"
            const isActive = m && ACTIVE.includes(m.status)
            return (
              <Card key={g.id} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <UsersRound className="size-4 text-primary" /> {g.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={m?.status ?? "NONE"} />
                      {isRunning && m?.remainingMs != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatRemaining(m.remainingMs)}
                        </span>
                      )}
                      {m && <OsIcon os={m.os} className="size-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGroup(g)}
                    disabled={busy[g.id]}
                    className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    title="Delete group"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {g.students.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No members yet.</span>
                  ) : (
                    g.students.map((s) => (
                      <span key={s.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
                        {s.name}
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(g)}>
                    <Pencil className="size-3.5" /> Members
                  </Button>
                  {isRunning && m?.previewUrl ? (
                    <>
                      <Button variant="ink" size="sm" onClick={() => onWatch(m.id)}>
                        <Monitor className="size-3.5" /> Watch
                      </Button>
                      <Button variant="outline" size="icon-sm" onClick={() => onFiles(m.id, `${g.name} group`)} title="Browse shared files">
                        <FolderOpen className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => stopGroup(g)}
                        disabled={busy[g.id]}
                      >
                        {busy[g.id] ? <Spinner className="size-3.5" /> : <Power className="size-3.5" />}
                      </Button>
                    </>
                  ) : isActive ? (
                    <Button variant="outline" size="sm" disabled>
                      <Spinner className="size-3.5" /> Booting…
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bootGroup(g)}
                      disabled={busy[g.id] || g.students.length === 0}
                      title={g.students.length === 0 ? "Add members first" : undefined}
                    >
                      {busy[g.id] ? <Spinner className="size-3.5" /> : <Rocket className="size-3.5" />} Boot shared desktop
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <MembersModal
        classId={classId}
        group={editing}
        students={students}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onChange()
        }}
      />
    </div>
  )
}

function MembersModal({
  classId,
  group,
  students,
  onOpenChange,
  onSaved,
}: {
  classId: string
  group: Group | null
  students: RosterStudent[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [initFor, setInitFor] = useState<string | null>(null)

  // Seed the checklist from the group's current members when it opens.
  if (group && initFor !== group.id) {
    setInitFor(group.id)
    setSelected(new Set(group.students.map((s) => s.id)))
  }

  async function save() {
    if (!group) return
    setSaving(true)
    try {
      await api(`/api/classes/${classId}/groups/${group.id}`, {
        method: "PATCH",
        body: { studentIds: [...selected] },
      })
      onSaved()
    } catch (e) {
      toast.error("Could not save members", (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Members of {group?.name}</DialogTitle>
          <DialogDescription>
            Pick who shares this group&apos;s desktop. A student can be in only one group at a time.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {students.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No students in this class yet.</p>
          ) : (
            students.map((s) => {
              const checked = selected.has(s.id)
              const inOther = !!s.groupId && s.groupId !== group?.id
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                    checked ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(s.id)
                        else next.delete(s.id)
                        return next
                      })
                    }}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="flex-1 font-medium text-foreground">{s.name}</span>
                  {inOther && !checked && (
                    <span className="text-[11px] text-muted-foreground">in another group</span>
                  )}
                </label>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="ink" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-3.5" /> : null} Save members
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
