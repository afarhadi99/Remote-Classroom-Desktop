import { prisma } from '@/lib/prisma'
import { apiError, getTeacher } from '@/lib/api'

export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Download every private teacher note in a class as one CSV — a quick progress-report
// export. Notes are teacher-only (never shown to students), so this stays behind the same
// ownership check as everything else here; nothing new is exposed, just batched for print.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const students = await prisma.student.findMany({
    where: { classroomId: id, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { name: true, teacherNote: true },
  })

  const header = ['Student', 'Note']
  const rows = students.map((s) => [s.name, s.teacherNote ?? ''])
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'

  const safe = classroom.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'class'
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="notes-${safe}.csv"`,
    },
  })
}
