import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { hashPassword } from '@/lib/auth'

const schema = z.object({
  // A new PIN to set, or null to clear it (lets the student re-claim on next join).
  pin: z.string().trim().min(4).max(12).nullable(),
})

// Teacher sets or clears a student's join PIN from the roster.
export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classroom: true },
  })
  if (!student || student.classroom.teacherId !== teacher.id) {
    return apiError('Student not found.', 404)
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('A PIN must be 4–12 characters.')

  await prisma.student.update({
    where: { id: studentId },
    data: { joinPin: parsed.data.pin ? await hashPassword(parsed.data.pin) : null },
  })
  return json({ ok: true, hasPin: !!parsed.data.pin })
}
