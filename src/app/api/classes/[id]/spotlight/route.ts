import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  // machineId to spotlight, or null to stop broadcasting.
  machineId: z.string().min(1).nullable(),
})

// Broadcast / spotlight: the teacher picks one running desktop and every student in the
// class sees a live view-only stream of it as a full-screen overlay. Pass machineId: null
// to stop. The proxy (server.mjs) authorizes students against the class's current
// spotlightMachineId so they can reach that one host while it's spotlighted.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request.')
  const { machineId } = parsed.data

  if (machineId) {
    const machine = await prisma.machine.findFirst({
      where: { id: machineId, classroomId: id },
      include: { student: true },
    })
    if (!machine) return apiError('That desktop is not in this class.', 404)
    if (machine.status !== 'RUNNING') return apiError('That desktop is not running.')

    await prisma.classroom.update({ where: { id }, data: { spotlightMachineId: machineId } })
    await logEvent({
      classroomId: id,
      studentId: machine.studentId,
      type: 'spotlight',
      actorRole: 'teacher',
      message: `Spotlighted ${machine.student?.name ?? 'a student'}'s screen to the class`,
    })
    return json({ ok: true, spotlightMachineId: machineId })
  }

  if (classroom.spotlightMachineId) {
    await prisma.classroom.update({ where: { id }, data: { spotlightMachineId: null } })
    await logEvent({
      classroomId: id,
      type: 'spotlight',
      actorRole: 'teacher',
      message: 'Stopped the class spotlight',
    })
  }
  return json({ ok: true, spotlightMachineId: null })
}
