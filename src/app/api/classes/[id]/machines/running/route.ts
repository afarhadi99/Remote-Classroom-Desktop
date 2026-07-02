import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { viewOnlyUrlFromPreview } from '@/lib/daytona'

export const dynamic = 'force-dynamic'

// Live list of a class's running/booting desktops for the teacher monitor wall.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const machines = await prisma.machine.findMany({
    where: { classroomId: id, status: { in: ['RUNNING', 'PROVISIONING'] } },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    include: { student: true, group: true },
  })

  const now = Date.now()
  return json({
    spotlightMachineId: classroom.spotlightMachineId,
    machines: machines.map((m) => ({
      id: m.id,
      studentId: m.studentId,
      studentName: m.student?.name ?? (m.group ? `${m.group.name} (group)` : null),
      os: m.os,
      status: m.status,
      tileUrl:
        m.status === 'RUNNING' && m.previewUrl ? viewOnlyUrlFromPreview(m.previewUrl) : null,
      previewUrl: m.status === 'RUNNING' ? m.previewUrl : null,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      remainingMs: m.status === 'RUNNING' && m.expiresAt ? m.expiresAt.getTime() - now : null,
    })),
  })
}
