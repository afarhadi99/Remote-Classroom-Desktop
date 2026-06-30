"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, CreditCard, LayoutDashboard, ShieldCheck } from "lucide-react"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/Toast"
import { api } from "@/lib/client"
import { initialsOf } from "@/lib/utils"

export function AppHeader({ name, role }: { name: string; role: "teacher" | "student" }) {
  const router = useRouter()
  const toast = useToast()

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  async function revokeAll() {
    if (!confirm("Sign out of all other devices? You'll stay signed in here.")) return
    try {
      await api("/api/teacher/account/revoke-sessions", { method: "POST" })
      toast.success("Signed out everywhere else", "Other devices will need to log in again.")
    } catch (e) {
      toast.error("Could not sign out other devices", (e as Error).message)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
        <Brand href={role === "teacher" ? "/teacher" : "/student"} />
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-ink text-[11px] font-semibold text-background">
                {initialsOf(name) || (role === "teacher" ? "T" : "S")}
              </AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium text-foreground">{name}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{role}</p>
            </div>
          </div>
          {role === "teacher" && (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/teacher/admin">
                  <LayoutDashboard className="size-3.5" /> <span className="hidden sm:inline">Console</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/teacher/billing">
                  <CreditCard className="size-3.5" /> <span className="hidden sm:inline">Plan</span>
                </Link>
              </Button>
              <Button onClick={revokeAll} variant="ghost" size="sm" title="Sign out of all other devices">
                <ShieldCheck className="size-3.5" /> <span className="hidden sm:inline">Sign out all</span>
              </Button>
            </>
          )}
          <Button onClick={logout} variant="outline" size="sm">
            <LogOut className="size-3.5" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
