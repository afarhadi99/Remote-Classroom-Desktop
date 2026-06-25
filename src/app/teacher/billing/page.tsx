import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AppHeader } from '@/components/AppHeader'
import { BillingPanel } from './BillingPanel'

export const metadata = { title: 'Billing — Remote Classroom Desktop' }

export default async function BillingPage() {
  const session = await getSession()
  if (!session || session.role !== 'teacher') redirect('/teacher/login')

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={session.name} role="teacher" />
      <BillingPanel />
    </div>
  )
}
