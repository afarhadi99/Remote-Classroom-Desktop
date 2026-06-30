import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  // The private message, or null to clear it.
  text: z.string().trim().max(280).nullable(),
})

// Teacher sends (or clears) a private 1:1 nudge to a single student.
export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid message.')
  const text = parsed.data.text?.trim() || null

  await prisma.student.update({
    where: { id: studentId },
    data: { nudge: text, nudgeAt: text ? new Date() : null },
  })
  if (text) {
    await logEvent({
      classroomId: student.classroomId,
      studentId,
      type: 'announce',
      actorRole: 'teacher',
      message: `Sent ${student.name} a private message`,
    })
  }
  return json({ ok: true })
}
