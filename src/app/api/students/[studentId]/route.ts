import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { stopMachine } from '@/lib/machines'
import { destroyVolume } from '@/lib/daytona'
import { logEvent } from '@/lib/events'

const ACTIVE = ['RUNNING', 'PROVISIONING']

// Right-to-erasure: permanently delete a student — stop any running desktop, delete their
// persistent volume (files), and remove the record. Irreversible.
export async function DELETE(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classroom: true, machines: { where: { status: { in: ACTIVE } } } },
  })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  // Tear down any running desktop, then erase the persistent volume holding their files.
  for (const m of student.machines) await stopMachine(m.id)
  if (student.volumeName || student.volumeId) {
    await destroyVolume(student.volumeName || `rcd-vol-${student.id}`)
  }

  const name = student.name
  const classroomId = student.classroomId
  await prisma.student.delete({ where: { id: studentId } })
  await logEvent({
    classroomId,
    type: 'stopped',
    actorRole: 'teacher',
    message: `Erased ${name} and their files (right-to-erasure)`,
  })
  return json({ ok: true })
}
