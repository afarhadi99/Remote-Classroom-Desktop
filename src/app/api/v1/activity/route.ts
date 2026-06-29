import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'

export const dynamic = 'force-dynamic'

// GET /api/v1/activity?classId=&limit= — recent activity events across the teacher's classes.
export async function GET(req: Request) {
  const caller = await getApiCaller(req, 'activity:read')
  if (!caller.ok) return apiError(caller.error, caller.status)

  const url = new URL(req.url)
  const classId = url.searchParams.get('classId')
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))

  // Constrain to classes the caller owns.
  const owned = await prisma.classroom.findMany({ where: { teacherId: caller.teacherId }, select: { id: true } })
  const ownedIds = owned.map((c) => c.id)
  const where = classId
    ? { classroomId: ownedIds.includes(classId) ? classId : '__none__' }
    : { classroomId: { in: ownedIds.length ? ownedIds : ['__none__'] } }

  const events = await prisma.classEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { student: { select: { name: true } } },
  })
  return json({
    events: events.map((e) => ({
      id: e.id,
      classroomId: e.classroomId,
      type: e.type,
      message: e.message,
      actorRole: e.actorRole,
      studentName: e.student?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
