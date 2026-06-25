import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AppHeader } from '@/components/AppHeader'
import { StudentDashboard } from './StudentDashboard'

export default async function StudentPage() {
  const session = await getSession()
  if (!session || session.role !== 'student') redirect('/join')

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={session.name} role="student" />
      <StudentDashboard />
    </div>
  )
}
