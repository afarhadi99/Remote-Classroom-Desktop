import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { stopClassroomMachines } from '@/lib/machines'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const stopped = await stopClassroomMachines(id)
  return json({ ok: true, stopped })
}
