import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

// Teacher heartbeat while viewing/controlling a student's desktop. Powers the student's
// "your teacher is viewing your screen" banner. Called every ~15s by the desktop viewer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const machine = await prisma.machine.findUnique({ where: { id }, include: { classroom: true } })
  if (!machine || machine.classroom.teacherId !== teacher.id) {
    return apiError('Machine not found.', 404)
  }

  await prisma.machine.update({
    where: { id },
    data: { watchedUntil: new Date(Date.now() + 30_000) },
  })
  return json({ ok: true })
}
