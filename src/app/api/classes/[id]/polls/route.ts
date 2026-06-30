import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

// Current open poll for the class (so the teacher can resume the live results view).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const poll = await prisma.poll.findFirst({ where: { classroomId: id, closedAt: null }, orderBy: { openedAt: 'desc' } })
  return json({ activePoll: poll ? { id: poll.id, prompt: poll.prompt, type: poll.type, options: poll.options ?? [] } : null })
}

const schema = z.object({
  prompt: z.string().trim().min(1).max(300),
  type: z.enum(['mcq', 'short']).default('mcq'),
  options: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
})

// Open a new poll / exit ticket (closes any currently-open one first — one live poll per class).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter a question.')
  const { prompt, type } = parsed.data
  const options = (parsed.data.options ?? []).map((o) => o.trim()).filter(Boolean)
  if (type === 'mcq' && options.length < 2) return apiError('Multiple-choice needs at least two options.')

  await prisma.poll.updateMany({ where: { classroomId: id, closedAt: null }, data: { closedAt: new Date() } })
  const poll = await prisma.poll.create({
    data: { classroomId: id, prompt, type, options: type === 'mcq' ? options : undefined },
  })
  return json({ ok: true, poll: { id: poll.id, prompt: poll.prompt, type: poll.type, options } })
}
