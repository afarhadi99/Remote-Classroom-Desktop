import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeepLinkPicker } from './DeepLinkPicker'

export default async function DeepLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'teacher') redirect('/teacher/login')

  const dl = await prisma.ltiDeepLinkSession.findUnique({ where: { id } })
  const valid = !!dl && dl.teacherId === session.id && !dl.usedAt && dl.expiresAt.getTime() > Date.now()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <DeepLinkPicker sessionId={id} valid={valid} />
    </div>
  )
}
