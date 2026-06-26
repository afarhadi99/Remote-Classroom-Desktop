import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { isOsType } from '@/lib/os'

export const dynamic = 'force-dynamic'

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const schedules = await prisma.classSchedule.findMany({
    where: { classroomId: id },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  })
  return json({
    schedules: schedules.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startMinute: s.startMinute,
      durationMin: s.durationMin,
      os: s.os,
      enabled: s.enabled,
    })),
  })
}

const createSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(480),
  os: z.string().refine(isOsType, 'Invalid OS'),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid schedule.')

  const s = await prisma.classSchedule.create({ data: { ...parsed.data, classroomId: id } })
  return json({ ok: true, id: s.id })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const scheduleId = new URL(req.url).searchParams.get('scheduleId')
  if (!scheduleId) return apiError('Missing scheduleId.', 400)
  await prisma.classSchedule.deleteMany({ where: { id: scheduleId, classroomId: id } })
  return json({ ok: true })
}
