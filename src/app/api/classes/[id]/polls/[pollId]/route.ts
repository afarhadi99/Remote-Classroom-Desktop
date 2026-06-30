import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Live results / tally for a poll (teacher cockpit).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, pollId } = await params

  const poll = await prisma.poll.findFirst({ where: { id: pollId, classroom: { id, teacherId: teacher.id } } })
  if (!poll) return apiError('Poll not found.', 404)

  const responses = await prisma.pollResponse.findMany({ where: { pollId } })
  const totalStudents = await prisma.student.count({ where: { classroomId: id, archivedAt: null } })
  const options = (poll.options as string[] | null) ?? []

  // Map studentId -> name for short-answer display.
  const names = Object.fromEntries(
    (await prisma.student.findMany({ where: { id: { in: responses.map((r) => r.studentId) } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
  )

  const tally = options.map((_, i) => responses.filter((r) => r.choice === i).length)
  const answers = poll.type === 'short' ? responses.filter((r) => r.text).map((r) => ({ name: names[r.studentId] ?? 'Student', text: r.text })) : []

  return json({
    poll: { id: poll.id, prompt: poll.prompt, type: poll.type, options, closed: !!poll.closedAt },
    answered: responses.length,
    totalStudents,
    tally,
    answers,
  })
}

// Close a poll (freezes results).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, pollId } = await params

  const poll = await prisma.poll.findFirst({ where: { id: pollId, classroom: { id, teacherId: teacher.id } } })
  if (!poll) return apiError('Poll not found.', 404)
  if (!poll.closedAt) await prisma.poll.update({ where: { id: pollId }, data: { closedAt: new Date() } })

  const { logEvent } = await import('@/lib/events')
  const count = await prisma.pollResponse.count({ where: { pollId } })
  await logEvent({ classroomId: id, type: 'poll', actorRole: 'teacher', message: `Closed poll “${poll.prompt}” (${count} responses)` })
  return json({ ok: true })
}
