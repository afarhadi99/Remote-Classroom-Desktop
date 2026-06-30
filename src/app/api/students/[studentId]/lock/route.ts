import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  locked: z.boolean(),
  message: z.string().trim().max(200).optional(),
})

// Teacher locks (or unlocks) a single student's screen — a targeted "eyes on me" for one
// off-task student, independent of the whole-class lock.
export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request.')

  await prisma.student.update({
    where: { id: studentId },
    data: {
      lockedAt: parsed.data.locked ? new Date() : null,
      lockMessage: parsed.data.locked ? parsed.data.message?.trim() || null : null,
    },
  })
  await logEvent({
    classroomId: student.classroomId,
    studentId,
    type: parsed.data.locked ? 'lock' : 'unlock',
    actorRole: 'teacher',
    message: `${parsed.data.locked ? 'Locked' : 'Unlocked'} ${student.name}'s screen`,
  })
  return json({ ok: true })
}
