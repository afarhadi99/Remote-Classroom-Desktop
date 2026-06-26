import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getPlan, isUnlimited } from '@/lib/plans'

const schema = z.object({
  names: z.array(z.string()).min(1).max(500),
})

// Bulk-add students to a class by name (paste / CSV import). The achievable form of
// "roster sync" without a Google Classroom / Clever OAuth integration: a teacher pastes
// or uploads a class list and we create the student identities in one shot. Re-importing
// the same names is a no-op (idempotent), so it's safe to paste an updated roster.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Paste at least one student name.')

  // Normalize: trim, collapse inner whitespace, drop blanks, cap length, de-dupe (keep
  // first spelling of each case-insensitive name).
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of parsed.data.names) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  if (names.length === 0) return apiError('No valid names found.')

  const teacherRecord = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  const plan = getPlan(teacherRecord?.plan)

  // Which of these already exist (case-insensitive)? Those are skipped, not errors.
  const existing = await prisma.student.findMany({
    where: { classroomId: id },
    select: { name: true },
  })
  const existingKeys = new Set(existing.map((s) => s.name.toLowerCase()))
  const fresh = names.filter((n) => !existingKeys.has(n.toLowerCase()))

  // Enforce the plan's per-class cap. Add as many as fit; report the rest as "full".
  let toCreate = fresh
  let skippedFull = 0
  if (!isUnlimited(plan.maxStudentsPerClass)) {
    const room = Math.max(0, plan.maxStudentsPerClass - existing.length)
    if (fresh.length > room) {
      toCreate = fresh.slice(0, room)
      skippedFull = fresh.length - room
    }
  }

  if (toCreate.length > 0) {
    await prisma.student.createMany({
      data: toCreate.map((name) => ({ classroomId: id, name })),
      skipDuplicates: true,
    })
  }

  return json({
    ok: true,
    added: toCreate.length,
    skippedExisting: names.length - fresh.length,
    skippedFull,
    cap: isUnlimited(plan.maxStudentsPerClass) ? null : plan.maxStudentsPerClass,
  })
}
