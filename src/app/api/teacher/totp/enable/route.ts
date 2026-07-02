import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { verifyTotpCode, generateBackupCodes } from '@/lib/totp'

const schema = z.object({ code: z.string().min(1) })

// Confirms the code from the authenticator app, flips totpEnabled on, and issues a fresh
// set of backup codes (shown to the teacher exactly once — only the hashes are stored).
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter the 6-digit code.')

  const teacherRow = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  if (!teacherRow?.totpSecret) return apiError('Start setup first.', 400)

  if (!verifyTotpCode(teacherRow.totpSecret, parsed.data.code)) {
    return apiError('Incorrect code. Check the time on your phone and try again.', 401)
  }

  const backupCodes = generateBackupCodes()
  const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)))

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { totpEnabled: true, totpBackupCodes: hashed },
  })

  return json({ ok: true, backupCodes })
}
