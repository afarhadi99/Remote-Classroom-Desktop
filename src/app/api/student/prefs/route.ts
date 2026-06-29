import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'

const schema = z.object({
  connectionSaver: z.boolean(),
})

// Persist a student's own desktop preferences (currently the low-bandwidth connection saver).
export async function PATCH(req: Request) {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid preferences.')

  await prisma.student.update({
    where: { id: student.id },
    data: { connectionSaver: parsed.data.connectionSaver },
  })
  return json({ ok: true, connectionSaver: parsed.data.connectionSaver })
}
