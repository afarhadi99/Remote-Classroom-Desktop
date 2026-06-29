import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  // The announcement text, or null/empty to clear it.
  text: z.string().trim().max(280).nullable(),
})

// Post (or clear) a text announcement that every student in the class sees as a banner.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid announcement.')

  const text = parsed.data.text?.trim() || null
  await prisma.classroom.update({
    where: { id },
    data: { announcement: text, announcementAt: text ? new Date() : null },
  })
  await logEvent({
    classroomId: id,
    type: 'announce',
    actorRole: 'teacher',
    message: text ? `Announced: “${text}”` : 'Cleared the class announcement',
  })
  return json({ ok: true })
}
