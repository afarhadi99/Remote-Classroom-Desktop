import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { serializeMachine } from '@/lib/machines'

const ACTIVE = ['RUNNING', 'PROVISIONING']

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

// List a class's group workstations (with their shared desktop + members).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const groups = await prisma.classGroup.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      students: { select: { id: true, name: true } },
      machines: {
        where: { status: { in: ACTIVE } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { group: true },
      },
    },
  })

  return json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      students: g.students,
      machine: g.machines[0] ? serializeMachine(g.machines[0]) : null,
    })),
  })
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  studentIds: z.array(z.string()).max(200).optional(),
})

// Create a group, optionally assigning members up front.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Enter a group name.')

  const group = await prisma.classGroup.create({ data: { classroomId: id, name: parsed.data.name } })

  if (parsed.data.studentIds?.length) {
    // Only reassign students that actually belong to this class.
    await prisma.student.updateMany({
      where: { id: { in: parsed.data.studentIds }, classroomId: id },
      data: { groupId: group.id },
    })
  }

  return json({ ok: true, group: { id: group.id, name: group.name } })
}
