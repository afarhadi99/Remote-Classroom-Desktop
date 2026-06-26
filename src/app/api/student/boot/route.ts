import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { bootMachineForStudent, serializeMachine } from '@/lib/machines'
import type { OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

// Student boots their own desktop using the class's configured OS + time limit.
export async function POST() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const classroom = await prisma.classroom.findUnique({ where: { id: student.classroomId } })
  if (!classroom) return apiError('Your class no longer exists.', 404)
  if (!classroom.allowStudentBoot) {
    return apiError('Your teacher has disabled self-service booting for this class.', 403)
  }

  const result = await bootMachineForStudent({
    classroomId: classroom.id,
    studentId: student.id,
    os: classroom.defaultOs as OsType,
    durationMin: classroom.defaultDurationMin,
  })
  if (!result.ok) return apiError(result.studentReason, 403)

  await logEvent({
    classroomId: classroom.id,
    studentId: student.id,
    type: 'boot',
    actorRole: 'student',
    message: `${student.name} started a ${classroom.defaultOs} desktop`,
  })

  return json({ ok: true, machine: serializeMachine(result.machine) })
}
