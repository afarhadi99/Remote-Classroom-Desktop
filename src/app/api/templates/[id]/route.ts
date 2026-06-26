import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const tpl = await prisma.classTemplate.findFirst({ where: { id, teacherId: teacher.id } })
  if (!tpl) return apiError('Template not found.', 404)

  await prisma.classTemplate.delete({ where: { id } })
  return json({ ok: true })
}
