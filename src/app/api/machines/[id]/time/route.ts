import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { serializeMachine } from '@/lib/machines'
import { logEvent } from '@/lib/events'

const schema = z.object({
  deltaMinutes: z.number().int().min(-60).max(120),
})

// Teacher grants (or trims) time on a single running desktop — e.g. IEP/504 extra time or
// a late arriver — without raising the whole class's default. The hard-limit sweeper, the
// live countdown, and the 5/1/0.5-min warnings all key off expiresAt, so they follow for free.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const machine = await prisma.machine.findUnique({
    where: { id },
    include: { classroom: true, student: true, group: true },
  })
  if (!machine || machine.classroom.teacherId !== teacher.id) {
    return apiError('Machine not found.', 404)
  }
  if (machine.status !== 'RUNNING' || !machine.expiresAt) {
    return apiError('That desktop is not running.')
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid time adjustment.')

  // Never push the deadline below a 5-minute floor from now (so a trim can't kill it instantly).
  const floor = Date.now() + 5 * 60_000
  const proposed = machine.expiresAt.getTime() + parsed.data.deltaMinutes * 60_000
  const expiresAt = new Date(Math.max(floor, proposed))

  const updated = await prisma.machine.update({ where: { id }, data: { expiresAt } })

  const who = machine.student?.name ?? (machine.group ? `group ${machine.group.name}` : 'a desktop')
  const d = parsed.data.deltaMinutes
  await logEvent({
    classroomId: machine.classroomId,
    studentId: machine.studentId,
    type: 'extend',
    actorRole: 'teacher',
    message: `${d >= 0 ? 'Added' : 'Removed'} ${Math.abs(d)} min ${d >= 0 ? 'to' : 'from'} ${who}'s session`,
  })

  return json({ ok: true, machine: serializeMachine({ ...updated, student: machine.student, group: machine.group }) })
}
