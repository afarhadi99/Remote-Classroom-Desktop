'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/client'

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api('/api/auth/student/join', { body: { code, name } })
      router.push('/student')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Join your class"
      subtitle="Enter the code your teacher gave you and your name. No password needed."
      footer={
        <>
          Are you a teacher?{' '}
          <Link href="/teacher/login" className="text-indigo-400 hover:text-indigo-300">
            Log in here
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Class code</label>
          <input
            className="input text-center text-lg font-semibold uppercase tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC-123"
            autoCapitalize="characters"
            required
          />
        </div>
        <div>
          <label className="label">Your name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            required
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Spinner />} Enter classroom
        </button>
      </form>
    </AuthShell>
  )
}
