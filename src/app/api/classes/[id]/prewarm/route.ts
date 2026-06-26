import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { prewarmClassVolumes } from '@/lib/machines'
import { logEvent } from '@/lib/events'

// Pre-warm a class so first boots are fast: provisions every student's persistent volume
// ahead of time. Idempotent — students already warmed are skipped.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const result = await prewarmClassVolumes(id)
  if (result.warmed > 0) {
    await logEvent({
      classroomId: id,
      type: 'prewarm',
      actorRole: 'teacher',
      message: `Pre-warmed ${result.warmed} student volume${result.warmed === 1 ? '' : 's'} for faster boots`,
    })
  }
  return json({ ok: true, ...result })
}
