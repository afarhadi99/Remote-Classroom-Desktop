import { prisma } from '@/lib/prisma'
import { apiError, getTeacher } from '@/lib/api'

export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Download the class gradebook as a CSV matrix: one row per student, one column per assignment,
// each cell the score ("8/10"). Complements LTI AGS passback for teachers not using an LMS.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const [assignments, students] = await Promise.all([
    prisma.assignment.findMany({ where: { classroomId: id }, orderBy: { createdAt: 'asc' } }),
    prisma.student.findMany({ where: { classroomId: id, archivedAt: null }, orderBy: { name: 'asc' } }),
  ])
  const subs = await prisma.submission.findMany({ where: { assignmentId: { in: assignments.map((a) => a.id) } } })
  const byKey = new Map(subs.map((s) => [`${s.assignmentId}|${s.studentId}`, s]))

  const header = ['Student', ...assignments.map((a) => a.title)]
  const rows = students.map((st) => [
    st.name,
    ...assignments.map((a) => {
      const sub = byKey.get(`${a.id}|${st.id}`)
      return sub?.score != null ? `${sub.score}/${sub.scoreMax ?? ''}` : ''
    }),
  ])
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'

  const safe = classroom.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'class'
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="gradebook-${safe}.csv"`,
    },
  })
}
