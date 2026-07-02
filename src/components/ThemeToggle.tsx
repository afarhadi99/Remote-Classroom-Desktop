"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "rcd-theme"

// Inline, runs before paint via a <script> in the root layout — avoids a flash of the
// wrong theme on load. Kept as a plain string so it can be dropped straight into <head>.
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}')
    var dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch (e) {}
})()
`

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
    } catch {
      /* private-browsing / storage disabled — theme just won't persist */
    }
  }

  // Avoid rendering the wrong icon before we know the real state (hydration-safe).
  if (dark === null) return <div className={cn("size-9", className)} aria-hidden />

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-md border border-border bg-card text-muted-foreground transition hover:text-foreground",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
