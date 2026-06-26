import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AppHeader } from '@/components/AppHeader'
import { AdminConsole } from './AdminConsole'

export default async function AdminPage() {
  const session = await getSession()
  if (!session || session.role !== 'teacher') redirect('/teacher/login')

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={session.name} role="teacher" />
      <AdminConsole />
    </div>
  )
}
