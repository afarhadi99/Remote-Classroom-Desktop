import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { serializeMachine } from '@/lib/machines'

// Current student's class + their (single) active-or-latest machine.
export async function GET() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const [classroom, machine, studentRow] = await Promise.all([
    prisma.classroom.findUnique({ where: { id: student.classroomId } }),
    prisma.machine.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    }),
    prisma.student.findUnique({ where: { id: student.id } }),
  ])

  if (!classroom) return apiError('Your class no longer exists.', 404)

  return json({
    student: { id: student.id, name: student.name, hasFiles: !!studentRow?.volumeId },
    classroom: {
      id: classroom.id,
      name: classroom.name,
      defaultOs: classroom.defaultOs,
      defaultDurationMin: classroom.defaultDurationMin,
      allowStudentBoot: classroom.allowStudentBoot,
    },
    machine: machine ? serializeMachine(machine) : null,
  })
}
