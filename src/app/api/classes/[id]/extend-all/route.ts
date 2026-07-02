import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { logEvent } from '@/lib/events'

const schema = z.object({
  deltaMinutes: z.number().int().min(-60).max(120),
})

// Grants (or trims) time on every currently RUNNING desktop in a class at once — e.g. a
// lesson running long, or wrapping up early. Same floor rule as the per-machine endpoint
// (/api/machines/[id]/time): a trim can never push a deadline below 5 minutes from now.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid time adjustment.')

  const running = await prisma.machine.findMany({
    where: { classroomId: id, status: 'RUNNING', expiresAt: { not: null } },
    include: { student: true },
  })
  if (running.length === 0) return apiError('No desktops are currently running in this class.')

  const floor = Date.now() + 5 * 60_000
  const d = parsed.data.deltaMinutes

  await Promise.all(
    running.map((m) =>
      prisma.machine.update({
        where: { id: m.id },
        data: { expiresAt: new Date(Math.max(floor, m.expiresAt!.getTime() + d * 60_000)) },
      }),
    ),
  )

  // Granting time resolves any pending "ask for more time" requests in this class.
  if (d > 0) {
    const studentIds = running.map((m) => m.studentId).filter((sid): sid is string => !!sid)
    if (studentIds.length > 0) {
      await prisma.student.updateMany({
        where: { id: { in: studentIds }, timeRequestAt: { not: null } },
        data: { timeRequestAt: null },
      })
    }
  }

  await logEvent({
    classroomId: id,
    type: 'extend',
    actorRole: 'teacher',
    message: `${d >= 0 ? 'Added' : 'Removed'} ${Math.abs(d)} min ${d >= 0 ? 'to' : 'from'} ${running.length} running desktop${running.length === 1 ? '' : 's'}`,
  })

  return json({ ok: true, affected: running.length })
}
