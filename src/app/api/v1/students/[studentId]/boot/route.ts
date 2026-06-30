import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'
import { idempotent } from '@/lib/idempotency'
import { bootMachineForStudent, bootMachineForGroup, serializeMachine } from '@/lib/machines'
import type { OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

// POST /api/v1/students/{studentId}/boot — boot a student's (or their group's) desktop.
// Honors `Idempotency-Key` so a retried call doesn't kick off a second billable boot.
export async function POST(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const caller = await getApiCaller(req, 'desktops:write')
  if (!caller.ok) return apiError(caller.error, caller.status)
  const { studentId } = await params

  return idempotent(req, caller.keyId, async () => {
    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
    if (!student || student.classroom.teacherId !== caller.teacherId) return { status: 404, data: { error: 'Student not found.' } }

    const os = student.classroom.defaultOs as OsType
    const durationMin = student.classroom.defaultDurationMin
    const result = student.groupId
      ? await bootMachineForGroup({ classroomId: student.classroomId, groupId: student.groupId, os, durationMin })
      : await bootMachineForStudent({ classroomId: student.classroomId, studentId, os, durationMin })
    if (!result.ok) return { status: 403, data: { error: result.reason } }

    await logEvent({ classroomId: student.classroomId, studentId, type: 'boot', actorRole: 'system', message: `API: started a desktop for ${student.name}` })
    return { status: 200, data: { ok: true, machine: serializeMachine(result.machine) } }
  })
}
