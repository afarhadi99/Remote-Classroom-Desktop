import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { serializeMachine } from '@/lib/machines'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return apiError('Unauthorized', 401)
  const { id } = await params

  const machine = await prisma.machine.findUnique({
    where: { id },
    include: { student: true, classroom: true },
  })
  if (!machine) return apiError('Machine not found.', 404)

  const authorized =
    (session.role === 'teacher' && machine.classroom.teacherId === session.id) ||
    (session.role === 'student' && machine.studentId === session.id)
  if (!authorized) return apiError('Forbidden', 403)

  return json({ machine: serializeMachine(machine) })
}
