import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { bootMachineForStudent, bootMachineForGroup, serializeMachine } from '@/lib/machines'
import type { OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

// Student boots a desktop using the class's configured OS + time limit. If they belong to a
// group workstation, this starts (or joins) the group's shared desktop instead of a solo one.
export async function POST() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const studentRow = await prisma.student.findUnique({ where: { id: student.id } })
  if (!studentRow) return apiError('Your class no longer exists.', 404)

  const classroom = await prisma.classroom.findUnique({ where: { id: student.classroomId } })
  if (!classroom) return apiError('Your class no longer exists.', 404)

  // Quiet hours: students can only self-boot during the configured class window (teacher boots
  // bypass this). Checked before the self-service flag so the message is specific.
  const { withinBootWindow, minuteOfDay, formatMinute } = await import('@/lib/hours')
  if (!withinBootWindow(classroom.bootWindowStart, classroom.bootWindowEnd, minuteOfDay())) {
    return apiError(
      `Desktops are only available during class hours (${formatMinute(classroom.bootWindowStart!)}–${formatMinute(classroom.bootWindowEnd!)}).`,
      403,
    )
  }

  if (!classroom.allowStudentBoot) {
    return apiError('Your teacher has disabled self-service booting for this class.', 403)
  }

  const os = classroom.defaultOs as OsType

  if (studentRow.groupId) {
    const result = await bootMachineForGroup({
      classroomId: classroom.id,
      groupId: studentRow.groupId,
      os,
      durationMin: classroom.defaultDurationMin,
      background: after,
    })
    if (!result.ok) return apiError(result.studentReason, 403)
    await logEvent({
      classroomId: classroom.id,
      studentId: student.id,
      type: 'boot',
      actorRole: 'student',
      message: `${student.name} started their group's shared desktop`,
    })
    return json({ ok: true, machine: serializeMachine(result.machine) })
  }

  const result = await bootMachineForStudent({
    classroomId: classroom.id,
    studentId: student.id,
    os,
    durationMin: classroom.defaultDurationMin,
    background: after,
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
