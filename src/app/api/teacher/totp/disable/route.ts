import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { verifyPassword } from '@/lib/auth'

const schema = z.object({ password: z.string().min(1) })

// Disabling 2FA re-checks the password so a hijacked-but-not-fully-authenticated session
// (e.g. an unattended unlocked laptop) can't turn off the account's second factor.
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter your password.')

  const teacherRow = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!teacherRow) return apiError('Not found.', 404)

  const ok = await verifyPassword(parsed.data.password, teacherRow.password)
  if (!ok) return apiError('Incorrect password.', 401)

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  })

  return json({ ok: true })
}
