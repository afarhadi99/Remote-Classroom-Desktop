import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

function newToken() {
  return randomBytes(24).toString('base64url')
}

// Reports whether an active parent link already exists, without creating one.
export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  const link = await prisma.parentLink.findFirst({ where: { studentId, revokedAt: null } })
  return json({ ok: true, path: link ? `/parent/${link.token}` : null })
}

// Creates (or returns the existing) active parent/guardian view link for a student.
export async function POST(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  let link = await prisma.parentLink.findFirst({ where: { studentId, revokedAt: null } })
  if (!link) {
    link = await prisma.parentLink.create({ data: { studentId, token: newToken() } })
  }

  return json({ ok: true, path: `/parent/${link.token}` })
}

// Revokes the active parent link, if any.
export async function DELETE(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { classroom: true } })
  if (!student || student.classroom.teacherId !== teacher.id) return apiError('Student not found.', 404)

  await prisma.parentLink.updateMany({ where: { studentId, revokedAt: null }, data: { revokedAt: new Date() } })
  return json({ ok: true })
}
