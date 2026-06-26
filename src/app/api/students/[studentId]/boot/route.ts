import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { bootMachineForStudent, bootMachineForGroup, serializeMachine } from '@/lib/machines'
import { isOsType, type OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

const schema = z.object({
  os: z.string().refine(isOsType, 'Invalid OS').optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
})

// Teacher boots a single student's desktop.
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

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) return apiError('Invalid options.')

  const os: OsType = (parsed.data.os as OsType) ?? (student.classroom.defaultOs as OsType)
  const durationMin = parsed.data.durationMin ?? student.classroom.defaultDurationMin

  // A grouped student shares their group's desktop — boot that instead of a stray solo one.
  const result = student.groupId
    ? await bootMachineForGroup({ classroomId: student.classroomId, groupId: student.groupId, os, durationMin })
    : await bootMachineForStudent({ classroomId: student.classroomId, studentId: student.id, os, durationMin })
  if (!result.ok) return apiError(result.reason, 403)

  await logEvent({
    classroomId: student.classroomId,
    studentId: student.id,
    type: 'boot',
    actorRole: 'teacher',
    message: student.groupId
      ? `Teacher started the shared desktop for ${student.name}'s group`
      : `Teacher started a ${os} desktop for ${student.name}`,
  })

  return json({ ok: true, machine: serializeMachine(result.machine) })
}
