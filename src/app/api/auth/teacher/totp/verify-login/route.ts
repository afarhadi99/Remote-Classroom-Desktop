import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { verifyTotpChallengeToken, setSessionCookie } from '@/lib/auth'
import { verifyTotpCode } from '@/lib/totp'
import { clientIp, throttleKey, checkLock, recordFailure, recordSuccess } from '@/lib/throttle'

const schema = z.object({
  challenge: z.string().min(1),
  code: z.string().min(1),
})

// Second step of teacher login when TOTP is enabled: exchanges a short-lived challenge
// token (issued after the password check) plus a 6-digit code (or backup code) for a
// real session.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter the 6-digit code.')

  const teacherId = await verifyTotpChallengeToken(parsed.data.challenge)
  if (!teacherId) return apiError('That code expired. Log in again.', 401)

  const key = throttleKey('teacher-totp', clientIp(req), teacherId)
  const lock = checkLock(key)
  if (lock.locked) {
    const res = apiError('Too many attempts. Try again in a few minutes.', 429)
    res.headers.set('Retry-After', String(lock.retryAfterSec))
    return res
  }

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
  if (!teacher || !teacher.totpEnabled || !teacher.totpSecret) return apiError('Two-factor auth is not set up.', 401)

  const code = parsed.data.code.trim()
  let ok = verifyTotpCode(teacher.totpSecret, code)
  let usedBackupCode: string | null = null

  if (!ok) {
    // Fall back to backup codes (single-use, bcrypt-hashed).
    for (const hash of teacher.totpBackupCodes) {
      if (await bcrypt.compare(code, hash)) {
        ok = true
        usedBackupCode = hash
        break
      }
    }
  }

  if (!ok) {
    recordFailure(key)
    return apiError('Incorrect code.', 401)
  }

  recordSuccess(key)
  if (usedBackupCode) {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { totpBackupCodes: teacher.totpBackupCodes.filter((h) => h !== usedBackupCode) },
    })
  }

  await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
  return json({ ok: true, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } })
}
