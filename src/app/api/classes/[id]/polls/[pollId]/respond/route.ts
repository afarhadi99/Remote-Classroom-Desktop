import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'

const schema = z.object({
  choice: z.number().int().min(0).max(5).optional(),
  text: z.string().trim().max(500).optional(),
})

// A student answers the class's live poll. Re-submitting updates their answer.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)
  const { id, pollId } = await params
  if (student.classroomId !== id) return apiError('Not your class.', 403)

  const poll = await prisma.poll.findFirst({ where: { id: pollId, classroomId: id } })
  if (!poll) return apiError('Poll not found.', 404)
  if (poll.closedAt) return apiError('This poll is closed.', 409)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid response.')

  if (poll.type === 'mcq') {
    const options = (poll.options as string[] | null) ?? []
    if (parsed.data.choice == null || parsed.data.choice >= options.length) return apiError('Pick an option.')
  } else if (!parsed.data.text) {
    return apiError('Enter an answer.')
  }

  await prisma.pollResponse.upsert({
    where: { pollId_studentId: { pollId, studentId: student.id } },
    update: { choice: parsed.data.choice ?? null, text: parsed.data.text ?? null },
    create: { pollId, studentId: student.id, choice: parsed.data.choice ?? null, text: parsed.data.text ?? null },
  })
  return json({ ok: true })
}
