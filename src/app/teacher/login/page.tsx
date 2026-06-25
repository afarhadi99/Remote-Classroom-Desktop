'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { Spinner } from '@/components/ui'
import { api } from '@/lib/client'

export default function TeacherLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api('/api/auth/teacher/login', { body: { email, password } })
      router.push('/teacher')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Teacher login"
      subtitle="Welcome back. Log in to manage your classes."
      footer={
        <>
          New here?{' '}
          <Link href="/teacher/signup" className="text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading && <Spinner />} Log in
        </button>
      </form>
    </AuthShell>
  )
}
