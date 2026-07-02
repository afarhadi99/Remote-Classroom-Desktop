import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { monthlyUsage } from '@/lib/machines'
import { getPlan } from '@/lib/plans'

// PUBLIC — no session required. The token itself is the credential, and it only ever
// reveals a narrow, non-sensitive summary: no activity log, flags, teacher notes, or
// desktop content, and nothing about other students.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const link = await prisma.parentLink.findUnique({
    where: { token },
    include: {
      student: {
        include: {
          classroom: { include: { teacher: true } },
          machines: { where: { status: 'RUNNING' }, take: 1 },
        },
      },
    },
  })
  if (!link || link.revokedAt) return apiError('This link is no longer valid.', 404)
  if (link.student.archivedAt) return apiError('This link is no longer valid.', 404)

  const plan = getPlan(link.student.classroom.teacher.plan)
  const usage = monthlyUsage(link.student, plan)

  return json({
    studentName: link.student.name,
    className: link.student.classroom.name,
    joinedAt: link.student.joinedAt.toISOString(),
    currentlyActive: link.student.machines.length > 0,
    usage: { used: usage.used, remaining: usage.remaining, unlimited: usage.unlimited },
  })
}
