import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { serializeMachine, monthlyUsage } from '@/lib/machines'
import { getPlan } from '@/lib/plans'

// Current student's class + their (single) active-or-latest machine + remaining time.
export async function GET() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const studentRow = await prisma.student.findUnique({
    where: { id: student.id },
    include: { classroom: { include: { teacher: true } } },
  })
  if (!studentRow) return apiError('Your class no longer exists.', 404)

  const machine = await prisma.machine.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    include: { student: true },
  })

  const classroom = studentRow.classroom
  const plan = getPlan(classroom.teacher.plan)
  const usage = monthlyUsage(studentRow, plan)

  return json({
    student: { id: student.id, name: student.name, hasFiles: !!studentRow.volumeId },
    classroom: {
      id: classroom.id,
      name: classroom.name,
      defaultOs: classroom.defaultOs,
      defaultDurationMin: classroom.defaultDurationMin,
      allowStudentBoot: classroom.allowStudentBoot,
      locked: !!classroom.lockedAt,
      lockMessage: classroom.lockMessage,
    },
    // No pricing is ever exposed to students — just their remaining time.
    usage: {
      remaining: usage.remaining,
      unlimited: usage.unlimited,
      sessionCap: Math.min(classroom.defaultDurationMin, plan.maxSessionMinutes),
    },
    machine: machine ? serializeMachine(machine) : null,
    beingWatched:
      machine?.status === 'RUNNING' &&
      !!machine.watchedUntil &&
      machine.watchedUntil.getTime() > Date.now(),
  })
}
