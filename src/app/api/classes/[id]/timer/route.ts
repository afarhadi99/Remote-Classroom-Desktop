import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

const schema = z.object({
  minutes: z.number().int().min(1).max(180),
  label: z.string().trim().max(80).nullable().optional(),
})

// Starts (or restarts) a shared countdown timer visible live to every student in the class.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter a duration from 1 to 180 minutes.')

  const timerEndsAt = new Date(Date.now() + parsed.data.minutes * 60_000)
  await prisma.classroom.update({
    where: { id },
    data: { timerEndsAt, timerLabel: parsed.data.label?.trim() || null },
  })
  return json({ ok: true, timerEndsAt: timerEndsAt.toISOString() })
}

// Cancels the running timer early.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  await prisma.classroom.update({ where: { id }, data: { timerEndsAt: null, timerLabel: null } })
  return json({ ok: true })
}
