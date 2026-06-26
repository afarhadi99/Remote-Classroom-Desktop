import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { isOsType } from '@/lib/os'

export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const templates = await prisma.classTemplate.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
  })
  return json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      os: t.os,
      durationMin: t.durationMin,
      allowStudentBoot: t.allowStudentBoot,
    })),
  })
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  os: z.string().refine(isOsType, 'Invalid OS'),
  durationMin: z.number().int().min(5).max(480),
  allowStudentBoot: z.boolean(),
})

export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Please provide a name and valid settings.')

  const t = await prisma.classTemplate.create({ data: { ...parsed.data, teacherId: teacher.id } })
  return json({ ok: true, template: { id: t.id, name: t.name } })
}
