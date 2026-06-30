import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

const schema = z.object({
  items: z.array(z.string().trim().min(1).max(160)).max(20),
  step: z.number().int().min(0).max(19).nullable().optional(),
})

// Set (or clear) the class lesson agenda. Empty items clears it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid agenda.')

  const items = parsed.data.items.map((s) => s.trim()).filter(Boolean)
  const step = items.length && parsed.data.step != null && parsed.data.step < items.length ? parsed.data.step : null

  await prisma.classroom.update({
    where: { id },
    data: items.length ? { agenda: items, agendaStep: step } : { agenda: Prisma.DbNull, agendaStep: null },
  })
  return json({ ok: true, items, step })
}
