import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { setSessionCookie } from '@/lib/auth'

// "Sign out everywhere": invalidate every existing session for this teacher (lost/compromised
// device), then re-mint the caller's cookie so the current tab stays signed in.
export async function POST() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  await prisma.teacher.update({ where: { id: teacher.id }, data: { sessionsValidFrom: new Date() } })
  // Fresh token (new iat) for the current session so we don't lock the active user out.
  await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
  return json({ ok: true })
}
