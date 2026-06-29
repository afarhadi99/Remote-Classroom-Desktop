import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { nrpsSync } from '@/lib/lti-services'
import { logEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

// POST /api/classes/{id}/nrps-sync — pull the LMS course roster (LTI NRPS) into this class.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)
  if (!classroom.ltiNrpsUrl) return apiError('This class is not linked to an LMS roster service.', 409)

  try {
    const result = await nrpsSync(id)
    await logEvent({
      classroomId: id,
      type: 'provision_all',
      actorRole: 'system',
      message: `LMS roster sync: +${result.added} students, ${result.updated} updated, ${result.archived} archived`,
    })
    return json({ ok: true, ...result })
  } catch (e) {
    return apiError((e as Error).message, 502)
  }
}
