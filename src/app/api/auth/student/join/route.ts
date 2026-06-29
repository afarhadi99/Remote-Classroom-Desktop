import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { setSessionCookie, hashPassword, verifyPassword } from '@/lib/auth'
import { apiError, json } from '@/lib/api'
import { normalizeJoinCode } from '@/lib/utils'
import { getPlan, isUnlimited } from '@/lib/plans'

const schema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
  pin: z.string().trim().min(4).max(12).optional(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter the class code and your name.')

  const code = normalizeJoinCode(parsed.data.code)
  const name = parsed.data.name
  const pin = parsed.data.pin

  // joinCode is stored as XXX-XXX; compare normalized
  const classrooms = await prisma.classroom.findMany({ include: { teacher: true } })
  const classroom = classrooms.find((c) => normalizeJoinCode(c.joinCode) === code)
  if (!classroom) return apiError('That class code was not found. Double-check it with your teacher.', 404)

  const plan = getPlan(classroom.teacher.plan)
  const existing = await prisma.student.findUnique({
    where: { classroomId_name: { classroomId: classroom.id, name } },
  })

  // Per-student PIN gate: without it, anyone could type a classmate's name and open their
  // machine + persistent files. When the class requires a PIN, a returning student must match
  // their stored PIN; a first-time (or pre-PIN) student claims their name with the PIN they enter.
  if (classroom.requireJoinPin) {
    if (!pin) return apiError('This class requires a PIN to join. Ask your teacher for your PIN.', 401)
    if (existing?.joinPin && !(await verifyPassword(pin, existing.joinPin))) {
      return apiError('That PIN is incorrect.', 401)
    }
  }

  // Enforce the plan's per-class student cap for *new* students (re-joins are fine).
  if (!existing && !isUnlimited(plan.maxStudentsPerClass)) {
    const count = await prisma.student.count({ where: { classroomId: classroom.id } })
    if (count >= plan.maxStudentsPerClass) {
      return apiError(
        `This class is full (${plan.maxStudentsPerClass} students). Ask your teacher to make room or upgrade.`,
        403,
      )
    }
  }

  // Set/claim the PIN hash when the class requires one and the student doesn't have one yet.
  const pinHash =
    classroom.requireJoinPin && pin && !existing?.joinPin ? await hashPassword(pin) : undefined

  // Upsert the student identity (name unique per class). Re-joining with the same
  // name resumes the same account, machine and persistent files.
  const student = await prisma.student.upsert({
    where: { classroomId_name: { classroomId: classroom.id, name } },
    update: pinHash ? { joinPin: pinHash } : {},
    create: { classroomId: classroom.id, name, ...(pinHash ? { joinPin: pinHash } : {}) },
  })

  await setSessionCookie({
    role: 'student',
    id: student.id,
    name: student.name,
    classroomId: classroom.id,
  })
  return json({ ok: true, classroom: { id: classroom.id, name: classroom.name } })
}
