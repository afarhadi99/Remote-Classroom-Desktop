'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, AlertTriangle, X, Clock } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'timer'
interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

interface ToastApi {
  push: (t: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  timer: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-emerald-400" />,
  error: <AlertTriangle className="size-5 text-red-400" />,
  info: <Info className="size-5 text-sky-400" />,
  warning: <AlertTriangle className="size-5 text-amber-400" />,
  timer: <Clock className="size-5 text-amber-400" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++counter.current
      setToasts((prev) => [...prev, { ...t, id }])
      const ttl = t.kind === 'error' || t.kind === 'warning' || t.kind === 'timer' ? 7000 : 4000
      setTimeout(() => remove(id), ttl)
    },
    [remove],
  )

  const api: ToastApi = {
    push,
    success: (title, message) => push({ kind: 'success', title, message }),
    error: (title, message) => push({ kind: 'error', title, message }),
    info: (title, message) => push({ kind: 'info', title, message }),
    warning: (title, message) => push({ kind: 'warning', title, message }),
    timer: (title, message) => push({ kind: 'timer', title, message }),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-[#10162a]/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <div className="mt-0.5 shrink-0">{ICON[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-slate-400">{t.message}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
