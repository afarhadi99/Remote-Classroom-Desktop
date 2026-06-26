"use client"

import { createElement, type ReactNode } from "react"
import { toast as sonnerToast } from "sonner"
import { Clock } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"

// Stable, module-level API so `useToast()` returns the same reference every render
// (safe to use in effect/callback dependency arrays).
const api = {
  success: (title: string, message?: string) => sonnerToast.success(title, { description: message }),
  error: (title: string, message?: string) => sonnerToast.error(title, { description: message }),
  info: (title: string, message?: string) => sonnerToast.info(title, { description: message }),
  warning: (title: string, message?: string) => sonnerToast.warning(title, { description: message }),
  timer: (title: string, message?: string) =>
    sonnerToast(title, {
      description: message,
      icon: createElement(Clock, { className: "size-4 text-amber-500" }),
    }),
}

export function useToast() {
  return api
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors closeButton />
    </>
  )
}
