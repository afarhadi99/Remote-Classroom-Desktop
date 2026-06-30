import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

// Student asks their teacher for more time on the current session. The teacher sees a flag on
// the student's card and grants it with the existing +time control (which clears the request).
export async function POST() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const studentRow = await prisma.student.findUnique({ where: { id: student.id } })
  if (!studentRow) return apiError('Your class no longer exists.', 404)

  await prisma.student.update({ where: { id: student.id }, data: { timeRequestAt: new Date() } })
  await logEvent({
    classroomId: studentRow.classroomId,
    studentId: student.id,
    type: 'flag',
    actorRole: 'student',
    message: `${student.name} asked for more time`,
  })
  return json({ ok: true })
}

// Student withdraws the request.
export async function DELETE() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)
  await prisma.student.update({ where: { id: student.id }, data: { timeRequestAt: null } })
  return json({ ok: true })
}
