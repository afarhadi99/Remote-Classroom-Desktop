import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'
import { getPlan, isUnlimited } from '@/lib/plans'

export const dynamic = 'force-dynamic'

async function callerClass(req: Request, scope: 'roster:read' | 'roster:write', classId: string) {
  const caller = await getApiCaller(req, scope)
  if (!caller.ok) return { error: apiError(caller.error, caller.status) }
  const classroom = await prisma.classroom.findFirst({ where: { id: classId, teacherId: caller.teacherId } })
  if (!classroom) return { error: apiError('Class not found.', 404) }
  return { caller, classroom }
}

// GET /api/v1/classes/{id}/roster
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await callerClass(req, 'roster:read', id)
  if (r.error) return r.error
  const students = await prisma.student.findMany({
    where: { classroomId: id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, joinedAt: true },
  })
  return json({ students: students.map((s) => ({ id: s.id, name: s.name, joinedAt: s.joinedAt.toISOString() })) })
}

const putSchema = z.object({ names: z.array(z.string()).min(1).max(500) })

// PUT /api/v1/classes/{id}/roster — bulk-enroll students by name (idempotent).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await callerClass(req, 'roster:write', id)
  if (r.error) return r.error

  const body = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return apiError('Provide a non-empty "names" array.')

  // Normalize + de-dupe (case-insensitive).
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of parsed.data.names) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
  }
  if (!names.length) return apiError('No valid names.')

  const teacherRecord = await prisma.teacher.findUnique({ where: { id: r.caller.teacherId } })
  const plan = getPlan(teacherRecord?.plan)
  const existing = await prisma.student.findMany({ where: { classroomId: id }, select: { name: true } })
  const existingKeys = new Set(existing.map((s) => s.name.toLowerCase()))
  let fresh = names.filter((n) => !existingKeys.has(n.toLowerCase()))

  let skippedFull = 0
  if (!isUnlimited(plan.maxStudentsPerClass)) {
    const room = Math.max(0, plan.maxStudentsPerClass - existing.length)
    if (fresh.length > room) {
      skippedFull = fresh.length - room
      fresh = fresh.slice(0, room)
    }
  }
  if (fresh.length) {
    await prisma.student.createMany({
      data: fresh.map((name) => ({ classroomId: id, name })),
      skipDuplicates: true,
    })
  }

  const students = await prisma.student.findMany({
    where: { classroomId: id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return json({ added: fresh.length, skippedExisting: names.length - (fresh.length + skippedFull), skippedFull, students })
}
