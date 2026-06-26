import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { bootMachineForStudent, bootMachineForGroup } from '@/lib/machines'
import { isOsType, type OsType } from '@/lib/os'
import { logEvent } from '@/lib/events'

const schema = z.object({
  os: z.string().refine(isOsType, 'Invalid OS').optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
})

// Boot a desktop for every student in the class ("boot all").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) return apiError('Invalid provisioning options.')

  const os: OsType = (parsed.data.os as OsType) ?? (classroom.defaultOs as OsType)
  const durationMin = parsed.data.durationMin ?? classroom.defaultDurationMin

  const students = await prisma.student.findMany({ where: { classroomId: id } })
  if (students.length === 0) {
    return apiError('No students have joined this class yet. Share the class code first.', 400)
  }

  // Solo students each get their own desktop; grouped students share one desktop per group.
  const soloStudents = students.filter((s) => !s.groupId)
  const groups = await prisma.classGroup.findMany({
    where: { classroomId: id, students: { some: {} } },
  })

  const results = await Promise.all([
    ...soloStudents.map((s) => bootMachineForStudent({ classroomId: id, studentId: s.id, os, durationMin })),
    ...groups.map((g) => bootMachineForGroup({ classroomId: id, groupId: g.id, os, durationMin })),
  ])
  const booted = results.filter((r) => r.ok).length
  const skipped = results.length - booted

  await logEvent({
    classroomId: id,
    type: 'provision_all',
    actorRole: 'teacher',
    message: `Booted ${booted} ${os} desktop${booted === 1 ? '' : 's'} for the class (${durationMin} min)`,
  })

  return json({ ok: true, booted, skipped, os, durationMin })
}
