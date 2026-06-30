import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { logEvent } from '@/lib/events'
import { scanText } from '@/lib/safeguard'

const schema = z.object({
  kind: z.enum(['help', 'report']),
  note: z.string().trim().max(300).optional(),
})

// Panic / "raise hand" button. A student signals their teacher that they need help, or
// reports something they saw. This is the human-in-the-loop side of content safety: the
// teacher gets a live alert and can jump straight to that student's screen.
export async function POST(req: Request) {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request.')
  const { kind, note } = parsed.data

  const studentRow = await prisma.student.findUnique({ where: { id: student.id } })
  if (!studentRow) return apiError('Your class no longer exists.', 404)

  await prisma.student.update({
    where: { id: student.id },
    data: { flaggedAt: new Date(), flagKind: kind, flagNote: note ?? null },
  })
  await logEvent({
    classroomId: studentRow.classroomId,
    studentId: student.id,
    type: 'flag',
    actorRole: 'student',
    message:
      kind === 'help'
        ? `${student.name} raised their hand${note ? `: “${note}”` : ''}`
        : `${student.name} reported something${note ? `: “${note}”` : ''}`,
  })
  if (note) {
    await scanText(studentRow.classroomId, { studentId: student.id, studentName: student.name, source: kind === 'report' ? 'report' : 'note', text: note })
  }
  return json({ ok: true })
}

// Student lowers their own hand.
export async function DELETE() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)
  await prisma.student.update({
    where: { id: student.id },
    data: { flaggedAt: null, flagKind: null, flagNote: null },
  })
  return json({ ok: true })
}
