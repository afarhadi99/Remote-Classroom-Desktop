import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { generateJoinCode } from '@/lib/utils'
import { isOsType } from '@/lib/os'

export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const classes = await prisma.classroom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { students: true } },
      machines: { where: { status: { in: ['PROVISIONING', 'RUNNING'] } }, select: { id: true } },
    },
  })

  return json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.joinCode,
      defaultOs: c.defaultOs,
      defaultDurationMin: c.defaultDurationMin,
      allowStudentBoot: c.allowStudentBoot,
      studentCount: c._count.students,
      activeMachines: c.machines.length,
      createdAt: c.createdAt.toISOString(),
    })),
  })
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  defaultOs: z.string().refine(isOsType, 'Invalid OS').default('linux'),
  defaultDurationMin: z.number().int().min(5).max(480).default(60),
  allowStudentBoot: z.boolean().default(true),
})

export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Please provide a valid class name and settings.')

  // generate a unique join code
  let joinCode = generateJoinCode()
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.classroom.findUnique({ where: { joinCode } })
    if (!clash) break
    joinCode = generateJoinCode()
  }

  const classroom = await prisma.classroom.create({
    data: {
      name: parsed.data.name,
      joinCode,
      teacherId: teacher.id,
      defaultOs: parsed.data.defaultOs,
      defaultDurationMin: parsed.data.defaultDurationMin,
      allowStudentBoot: parsed.data.allowStudentBoot,
    },
  })

  return json({ ok: true, classroom: { id: classroom.id, joinCode: classroom.joinCode } })
}
