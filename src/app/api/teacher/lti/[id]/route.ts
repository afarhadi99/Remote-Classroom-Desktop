import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

// DELETE /api/teacher/lti/{id} — unregister an LMS platform.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  const p = await prisma.ltiPlatform.findUnique({ where: { id } })
  if (!p) return apiError('Platform not found.', 404)
  await prisma.ltiPlatform.delete({ where: { id } })
  return json({ ok: true })
}
