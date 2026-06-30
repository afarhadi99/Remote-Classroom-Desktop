import { createHash, createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Tamper-evident audit manifest: a deterministic SHA-256 over the class's full, ordered activity
// log plus an HMAC signature (JWT_SECRET). Archive it; re-generating later yields the same digest
// only if nothing in the log was altered, deleted, or reordered — so it proves log integrity.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const events = await prisma.classEvent.findMany({
    where: { classroomId: id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  // Canonical, stable serialization (one line per event).
  const canonical = events
    .map((e) => `${e.id}|${e.createdAt.toISOString()}|${e.type}|${e.actorRole ?? ''}|${e.studentId ?? ''}|${e.message}`)
    .join('\n')
  const sha256 = createHash('sha256').update(canonical).digest('hex')
  const secret = process.env.JWT_SECRET || 'insecure-dev-secret'
  const signature = createHmac('sha256', secret).update(sha256).digest('hex')

  return json({
    classId: id,
    count: events.length,
    from: events[0]?.createdAt.toISOString() ?? null,
    to: events[events.length - 1]?.createdAt.toISOString() ?? null,
    algorithm: 'sha256+hmac-sha256',
    sha256,
    signature,
    generatedAt: new Date().toISOString(),
  })
}
