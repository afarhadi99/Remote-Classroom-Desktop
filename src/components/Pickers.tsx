"use client"

import { Lock } from "lucide-react"
import { OS_LIST, type OsType } from "@/lib/os"
import { OsIcon } from "@/components/brand"
import { formatDurationLabel } from "@/lib/client"
import { cn } from "@/lib/utils"

export function OsPicker({ value, onChange }: { value: OsType; onChange: (os: OsType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OS_LIST.map((os) => {
        const active = value === os.id
        return (
          <button
            type="button"
            key={os.id}
            onClick={() => onChange(os.id)}
            className={cn(
              "group relative cursor-pointer rounded-lg border p-3.5 text-left transition",
              active
                ? "border-primary bg-accent ring-1 ring-primary"
                : "border-border bg-card hover:border-foreground/20 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-md",
                  os.id === "windows" ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-orange-700",
                )}
              >
                <OsIcon os={os.id} className="size-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">{os.short}</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {os.id === "windows" ? "Needs Windows enabled on your plan" : "Ready to boot"}
            </p>
            {active && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function DurationPicker({
  value,
  onChange,
  maxMinutes = Infinity,
}: {
  value: number
  onChange: (min: number) => void
  maxMinutes?: number
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DURATIONS.map((d) => {
        const locked = d > maxMinutes
        return (
          <button
            type="button"
            key={d}
            disabled={locked}
            onClick={() => !locked && onChange(d)}
            title={locked ? "Upgrade to Pro for longer sessions" : undefined}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition",
              locked
                ? "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground/50"
                : value === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted/50",
            )}
          >
            {formatDurationLabel(d)}
            {locked && <Lock className="size-3" />}
          </button>
        )
      })}
    </div>
  )
}
