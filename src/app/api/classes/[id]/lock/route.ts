import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

const schema = z.object({ locked: z.boolean(), message: z.string().trim().max(200).optional() })

// Toggle the class-wide "Eyes on me" focus lock.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request.')

  const updated = await prisma.classroom.update({
    where: { id },
    data: {
      lockedAt: parsed.data.locked ? new Date() : null,
      lockMessage: parsed.data.locked ? parsed.data.message || null : null,
    },
  })
  return json({ ok: true, locked: !!updated.lockedAt })
}
