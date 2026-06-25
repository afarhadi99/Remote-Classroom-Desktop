import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/auth'
import { apiError, json } from '@/lib/api'
import { normalizeJoinCode } from '@/lib/utils'

const schema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter the class code and your name.')

  const code = normalizeJoinCode(parsed.data.code)
  const name = parsed.data.name

  // joinCode is stored as XXX-XXX; compare normalized
  const classrooms = await prisma.classroom.findMany()
  const classroom = classrooms.find((c) => normalizeJoinCode(c.joinCode) === code)
  if (!classroom) return apiError('That class code was not found. Double-check it with your teacher.', 404)

  // Upsert the student identity (name unique per class). Re-joining with the same
  // name resumes the same account, machine and persistent files.
  const student = await prisma.student.upsert({
    where: { classroomId_name: { classroomId: classroom.id, name } },
    update: {},
    create: { classroomId: classroom.id, name },
  })

  await setSessionCookie({
    role: 'student',
    id: student.id,
    name: student.name,
    classroomId: classroom.id,
  })
  return json({ ok: true, classroom: { id: classroom.id, name: classroom.name } })
}
