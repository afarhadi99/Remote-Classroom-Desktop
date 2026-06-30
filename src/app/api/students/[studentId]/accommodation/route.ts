import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  // Extra session time as a percent: 50 => 1.5x, 100 => 2x. 0 clears the accommodation.
  extraTimePct: z.number().int().min(0).max(200),
})

// Teacher sets a student's extra-time accommodation (IEP/504), applied automatically at boot.
export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Extra time must be 0–200%.')

  await prisma.student.update({ where: { id: studentId }, data: { extraTimePct: parsed.data.extraTimePct } })
  await logEvent({
    classroomId: student.classroomId,
    studentId,
    type: 'extend',
    actorRole: 'teacher',
    message: parsed.data.extraTimePct > 0
      ? `Set ${student.name}'s extra-time accommodation to +${parsed.data.extraTimePct}%`
      : `Cleared ${student.name}'s extra-time accommodation`,
  })
  return json({ ok: true, extraTimePct: parsed.data.extraTimePct })
}
