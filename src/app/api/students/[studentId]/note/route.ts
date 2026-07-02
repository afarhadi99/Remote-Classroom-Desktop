import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

const schema = z.object({ note: z.string().max(4000).nullable() })

// Private teacher scratchpad for a student — never surfaced to the student themselves.
export async function PATCH(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Note is too long.')

  const note = parsed.data.note?.trim() || null
  await prisma.student.update({ where: { id: studentId }, data: { teacherNote: note } })
  return json({ ok: true })
}
