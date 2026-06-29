import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getDaytona, VOLUME_MOUNT_PATH } from '@/lib/daytona'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  studentId: z.string().min(1),
  score: z.number().int().min(0).max(100000).nullable().optional(),
  scoreMax: z.number().int().min(1).max(100000).nullable().optional(),
  feedback: z.string().max(5000).optional(),
})

// POST /api/classes/{id}/assignments/{aid}/handback — return graded work + feedback to a
// student's desktop (writes My-Files/Returned/<assignment>/feedback.json) and records the score.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, aid } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)
  const assignment = await prisma.assignment.findFirst({ where: { id: aid, classroomId: id } })
  if (!assignment) return apiError('Assignment not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid hand-back.')
  const { studentId, score = null, scoreMax = null, feedback } = parsed.data

  const student = await prisma.student.findFirst({ where: { id: studentId, classroomId: id } })
  if (!student) return apiError('Student not in this class.', 404)

  // Write the feedback artifact into the student's running desktop volume.
  const folder = assignment.title.replace(/[^a-zA-Z0-9 _-]/g, '_').slice(0, 60) || 'Assignment'
  const artifact = {
    assignment: assignment.title,
    score,
    scoreMax,
    feedback: feedback ?? '',
    returnedAt: new Date().toISOString(),
  }
  let wroteToDesktop = false
  const machine = await prisma.machine.findFirst({
    where: { studentId, status: 'RUNNING', sandboxId: { not: null } },
    orderBy: { createdAt: 'desc' },
  })
  if (machine?.sandboxId) {
    try {
      const sb = await getDaytona().get(machine.sandboxId)
      const dir = `${VOLUME_MOUNT_PATH}/Returned/${folder}`
      await sb.fs.createFolder(dir, '755').catch(() => {})
      await sb.fs.uploadFile(Buffer.from(JSON.stringify(artifact, null, 2)), `${dir}/feedback.json`)
      wroteToDesktop = true
    } catch {
      /* desktop offline — the score is still recorded below */
    }
  }

  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: aid, studentId } },
    update: { status: 'graded', score, scoreMax, feedback: feedback ?? null },
    create: { assignmentId: aid, studentId, status: 'graded', score, scoreMax, feedback: feedback ?? null },
  })
  await logEvent({
    classroomId: id,
    studentId,
    type: 'handout',
    actorRole: 'teacher',
    message: `Returned "${assignment.title}" to ${student.name}${score != null ? ` (${score}${scoreMax != null ? '/' + scoreMax : ''})` : ''}`,
  })

  return json({ ok: true, wroteToDesktop, submission: { status: submission.status, score: submission.score } })
}
