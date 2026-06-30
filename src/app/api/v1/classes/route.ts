import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'
import { idempotent } from '@/lib/idempotency'
import { generateJoinCode } from '@/lib/utils'
import { isOsType } from '@/lib/os'
import { getPlan, isUnlimited } from '@/lib/plans'
import { logEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

// GET /api/v1/classes — list the calling teacher's classes.
export async function GET(req: Request) {
  const caller = await getApiCaller(req, 'classes:read')
  if (!caller.ok) return apiError(caller.error, caller.status)

  const classes = await prisma.classroom.findMany({
    where: { teacherId: caller.teacherId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { students: true } } },
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

// POST /api/v1/classes — create a class. Honors an `Idempotency-Key` header so retries
// don't create duplicate classes.
export async function POST(req: Request) {
  const caller = await getApiCaller(req, 'classes:write')
  if (!caller.ok) return apiError(caller.error, caller.status)

  return idempotent(req, caller.keyId, async () => {
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return { status: 400, data: { error: 'Provide a valid class name and settings.' } }

    const teacherRecord = await prisma.teacher.findUnique({ where: { id: caller.teacherId } })
    const plan = getPlan(teacherRecord?.plan)
    const classCount = await prisma.classroom.count({ where: { teacherId: caller.teacherId } })
    if (!isUnlimited(plan.maxClasses) && classCount >= plan.maxClasses) {
      return { status: 402, data: { error: `Your ${plan.name} plan includes ${plan.maxClasses} class(es). Upgrade for more.` } }
    }

    let joinCode = generateJoinCode()
    for (let i = 0; i < 5; i++) {
      if (!(await prisma.classroom.findUnique({ where: { joinCode } }))) break
      joinCode = generateJoinCode()
    }

    const classroom = await prisma.classroom.create({
      data: {
        name: parsed.data.name,
        joinCode,
        teacherId: caller.teacherId,
        defaultOs: parsed.data.defaultOs,
        defaultDurationMin: Math.min(parsed.data.defaultDurationMin, plan.maxSessionMinutes),
        allowStudentBoot: parsed.data.allowStudentBoot,
      },
    })
    await logEvent({ classroomId: classroom.id, type: 'provision_all', actorRole: 'system', message: `Class created via API key` })
    return { status: 201, data: { id: classroom.id, name: classroom.name, joinCode: classroom.joinCode } }
  })
}
