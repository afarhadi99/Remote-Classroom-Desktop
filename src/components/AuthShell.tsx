import Link from 'next/link'
import type { ReactNode } from 'react'
import { Brand } from '@/components/ui'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand />
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="card p-7">
            <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
