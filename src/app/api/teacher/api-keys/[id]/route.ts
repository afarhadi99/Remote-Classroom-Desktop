import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

// DELETE /api/teacher/api-keys/{id} — revoke a key (kept for the audit trail, not deleted).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const key = await prisma.apiKey.findFirst({ where: { id, teacherId: teacher.id } })
  if (!key) return apiError('Key not found.', 404)

  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
  return json({ ok: true })
}
