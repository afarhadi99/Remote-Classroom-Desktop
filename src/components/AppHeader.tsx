'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Brand } from '@/components/ui'
import { api } from '@/lib/client'
import { initialsOf } from '@/lib/utils'

export function AppHeader({ name, role }: { name: string; role: 'teacher' | 'student' }) {
  const router = useRouter()

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070912]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
        <Brand href={role === 'teacher' ? '/teacher' : '/student'} />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
              {initialsOf(name) || (role === 'teacher' ? 'T' : 'S')}
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight text-slate-200">{name}</p>
              <p className="text-[11px] capitalize leading-tight text-slate-500">{role}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost btn-sm" title="Sign out">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
