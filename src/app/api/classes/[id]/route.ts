import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { serializeMachine, stopClassroomMachines } from '@/lib/machines'
import { isOsType } from '@/lib/os'

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  const [students, machines] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId: id },
      orderBy: { name: 'asc' },
      include: { machines: { orderBy: { createdAt: 'desc' }, take: 1, include: { student: true } } },
    }),
    prisma.machine.findMany({
      where: { classroomId: id },
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    }),
  ])

  return json({
    classroom: {
      id: classroom.id,
      name: classroom.name,
      joinCode: classroom.joinCode,
      defaultOs: classroom.defaultOs,
      defaultDurationMin: classroom.defaultDurationMin,
      allowStudentBoot: classroom.allowStudentBoot,
      createdAt: classroom.createdAt.toISOString(),
    },
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      joinedAt: s.joinedAt.toISOString(),
      machine: s.machines[0] ? serializeMachine(s.machines[0]) : null,
    })),
    machines: machines.map((m) => serializeMachine(m)),
  })
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  defaultOs: z.string().refine(isOsType, 'Invalid OS').optional(),
  defaultDurationMin: z.number().int().min(5).max(480).optional(),
  allowStudentBoot: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid settings.')

  const updated = await prisma.classroom.update({ where: { id }, data: parsed.data })
  return json({ ok: true, classroom: { id: updated.id, name: updated.name } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await ownedClass(teacher.id, id)
  if (!classroom) return apiError('Class not found.', 404)

  // tear down running desktops first, then delete the class (cascades students/machines)
  await stopClassroomMachines(id)
  await prisma.classroom.delete({ where: { id } })
  return json({ ok: true })
}
