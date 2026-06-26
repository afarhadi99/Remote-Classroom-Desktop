import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { bootMachineForGroup, serializeMachine } from '@/lib/machines'
import type { OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

// Teacher boots the shared desktop for a group workstation.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, groupId } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)
  const group = await prisma.classGroup.findFirst({ where: { id: groupId, classroomId: id } })
  if (!group) return apiError('Group not found.', 404)

  const memberCount = await prisma.student.count({ where: { groupId } })
  if (memberCount === 0) return apiError('Add at least one student to this group first.')

  const result = await bootMachineForGroup({
    classroomId: id,
    groupId,
    os: classroom.defaultOs as OsType,
    durationMin: classroom.defaultDurationMin,
  })
  if (!result.ok) return apiError(result.reason, 403)

  await logEvent({
    classroomId: id,
    type: 'boot',
    actorRole: 'teacher',
    message: `Started the shared desktop for group ${group.name}`,
  })
  return json({ ok: true, machine: serializeMachine(result.machine) })
}
