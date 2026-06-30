import { prisma } from '@/lib/prisma'
import { apiError, getTeacher } from '@/lib/api'

export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Download a class's full activity/audit log as CSV (records & compliance).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const events = await prisma.classEvent.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: 'desc' },
    take: 10000,
    include: { student: { select: { name: true } } },
  })

  const header = ['timestamp', 'type', 'actor', 'student', 'message']
  const rows = events.map((e) =>
    [e.createdAt.toISOString(), e.type, e.actorRole ?? '', e.student?.name ?? '', e.message].map(csvCell).join(','),
  )
  const csv = [header.join(','), ...rows].join('\n') + '\n'

  const safeName = classroom.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'class'
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="activity-${safeName}.csv"`,
    },
  })
}
