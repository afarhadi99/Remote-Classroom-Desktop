import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-[7px] bg-ink shadow-sm">
        <span className="absolute inset-x-0 top-0 h-[5px] bg-primary" />
        <svg viewBox="0 0 24 24" className="mt-1 size-4 text-background" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Remote Classroom
      </span>
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />
}

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "muted" | "destructive"; pulse?: boolean }
> = {
  RUNNING: { label: "Running", variant: "success" },
  PROVISIONING: { label: "Booting", variant: "warning", pulse: true },
  STOPPING: { label: "Stopping", variant: "muted", pulse: true },
  STOPPED: { label: "Stopped", variant: "muted" },
  EXPIRED: { label: "Time up", variant: "warning" },
  ERROR: { label: "Error", variant: "destructive" },
  PENDING: { label: "Idle", variant: "muted" },
  NONE: { label: "Not started", variant: "muted" },
}

const DOT: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  muted: "bg-muted-foreground/50",
  destructive: "bg-destructive",
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.NONE
  return (
    <Badge variant={s.variant} className="gap-1.5 font-medium">
      <span className={cn("size-1.5 rounded-full", DOT[s.variant], s.pulse && "animate-pulse")} />
      {s.label}
    </Badge>
  )
}

export function OsIcon({ os, className }: { os: string; className?: string }) {
  if (os === "windows") {
    return (
      <svg viewBox="0 0 24 24" className={cn("size-4", className)} fill="currentColor" aria-hidden>
        <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.5 1.2L21 21V12.5h-9.5v7.2Zm0-15.4v7.2H21V3l-9.5 1.3Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} fill="currentColor" aria-hidden>
      <path d="M12 2c-2.2 0-3.6 1.8-3.6 4.2 0 1.5-.5 2.4-1.4 3.6C5.7 11.6 5 13 5 14.7c0 .9-.5 1.6-1 2.4-.5.8-.4 1.7.4 2.1.6.3 1.3.1 2 .4.8.3 1.1 1.3 2.2 1.6 1 .3 2-.2 3-.2s2 .5 3 .2c1.1-.3 1.4-1.3 2.2-1.6.7-.3 1.4-.1 2-.4.8-.4.9-1.3.4-2.1-.5-.8-1-1.5-1-2.4 0-1.7-.7-3.1-2-4.9-.9-1.2-1.4-2.1-1.4-3.6C15.6 3.8 14.2 2 12 2Zm-1.6 4c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm3.2 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm-1.6 2.7c.7 0 1.6.5 1.6 1 0 .3-.9.7-1.6.7s-1.6-.4-1.6-.7c0-.5.9-1 1.6-1Z" />
    </svg>
  )
}
