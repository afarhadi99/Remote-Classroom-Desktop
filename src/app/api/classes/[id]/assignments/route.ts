import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

async function ownedClass(teacherId: string, id: string) {
  return prisma.classroom.findFirst({ where: { id, teacherId } })
}

// GET /api/classes/{id}/assignments — list assignments with each one's submissions.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const assignments = await prisma.assignment.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: 'desc' },
    include: { submissions: { include: { student: { select: { name: true } } } } },
  })
  return json({
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      collectFolder: a.collectFolder,
      submissions: a.submissions.map((sb) => ({
        studentId: sb.studentId,
        studentName: sb.student.name,
        status: sb.status,
        score: sb.score,
        scoreMax: sb.scoreMax,
        feedback: sb.feedback,
      })),
    })),
  })
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  collectFolder: z.string().trim().min(1).max(60).default('Turn-in'),
})

// POST /api/classes/{id}/assignments — create an assignment.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  if (!(await ownedClass(teacher.id, id))) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Provide an assignment title.')

  const a = await prisma.assignment.create({
    data: { classroomId: id, title: parsed.data.title, collectFolder: parsed.data.collectFolder },
  })
  return json({ ok: true, id: a.id }, 201)
}
