import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppHeader } from '@/components/AppHeader'
import { ClassManager } from './ClassManager'

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'teacher') redirect('/teacher/login')
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({
    where: { id, teacherId: session.id },
    select: { id: true },
  })
  if (!classroom) notFound()

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={session.name} role="teacher" />
      <ClassManager classId={id} />
    </div>
  )
}
