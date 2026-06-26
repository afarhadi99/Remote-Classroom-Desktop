import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  // A specific student to resolve, or null/omitted to clear every raised hand in the class.
  studentId: z.string().min(1).nullable().optional(),
})

// Teacher acknowledges / clears a student's raised hand (or all of them).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) return apiError('Invalid request.')
  const studentId = parsed.data.studentId ?? null

  const result = await prisma.student.updateMany({
    where: { classroomId: id, flaggedAt: { not: null }, ...(studentId ? { id: studentId } : {}) },
    data: { flaggedAt: null, flagKind: null, flagNote: null },
  })

  if (result.count > 0) {
    await logEvent({
      classroomId: id,
      studentId,
      type: 'flag',
      actorRole: 'teacher',
      message: studentId
        ? 'Resolved a raised hand'
        : `Cleared ${result.count} raised hand${result.count === 1 ? '' : 's'}`,
    })
  }
  return json({ ok: true, resolved: result.count })
}
