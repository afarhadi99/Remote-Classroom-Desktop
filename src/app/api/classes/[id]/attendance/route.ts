import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Attendance derived from desktop activity: a student is "present" on a day if their
// desktop was started (boot/running event) during that day.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const dateParam = new URL(req.url).searchParams.get('date')
  const base = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return apiError('Invalid date.', 400)
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

  const [students, events] = await Promise.all([
    prisma.student.findMany({ where: { classroomId: id }, orderBy: { name: 'asc' } }),
    prisma.classEvent.findMany({
      where: { classroomId: id, type: { in: ['boot', 'running'] }, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const firstSeen = new Map<string, Date>()
  for (const e of events) {
    if (e.studentId && !firstSeen.has(e.studentId)) firstSeen.set(e.studentId, e.createdAt)
  }

  const roster = students.map((s) => ({
    name: s.name,
    present: firstSeen.has(s.id),
    firstSeen: firstSeen.get(s.id)?.toISOString() ?? null,
  }))

  return json({
    date: dateStr,
    presentCount: roster.filter((r) => r.present).length,
    total: roster.length,
    students: roster,
  })
}
