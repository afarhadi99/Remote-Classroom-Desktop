import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Recent activity-log entries for a class (teacher only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const events = await prisma.classEvent.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { student: true },
  })

  return json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actorRole: e.actorRole,
      studentName: e.student?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
