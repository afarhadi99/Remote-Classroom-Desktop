import { prisma } from '@/lib/prisma'
import { apiError, getAdmin, json } from '@/lib/api'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']

// Every live/booting desktop across the whole platform, for admin oversight + force-stop.
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)

  const machines = await prisma.machine.findMany({
    where: { status: { in: ACTIVE } },
    orderBy: { startedAt: 'desc' },
    include: {
      student: { select: { name: true } },
      group: { select: { name: true } },
      classroom: { select: { name: true, teacher: { select: { name: true, email: true } } } },
    },
  })

  const now = Date.now()
  return json({
    desktops: machines.map((m) => {
      const startedAt = m.startedAt ? m.startedAt.getTime() : null
      const runMinutes = startedAt ? Math.max(0, Math.round((now - startedAt) / 60000)) : 0
      return {
        id: m.id,
        os: m.os,
        status: m.status,
        studentName: m.student?.name ?? (m.group ? `${m.group.name} (group)` : null),
        className: m.classroom.name,
        teacherName: m.classroom.teacher.name,
        teacherEmail: m.classroom.teacher.email,
        startedAt: m.startedAt ? m.startedAt.toISOString() : null,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
        remainingMs: m.status === 'RUNNING' && m.expiresAt ? m.expiresAt.getTime() - now : null,
        runMinutes,
        costCents: estimateCostCents(runMinutes),
      }
    }),
  })
}
