import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, setSessionCookie, DUMMY_BCRYPT_HASH } from '@/lib/auth'
import { apiError, json } from '@/lib/api'
import { clientIp, throttleKey, checkLock, recordFailure, recordSuccess } from '@/lib/throttle'

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter your email and password.')

  const { email, password } = parsed.data
  const key = throttleKey('teacher-login', clientIp(req), email)

  const lock = checkLock(key)
  if (lock.locked) {
    const res = apiError('Too many attempts. Try again in a few minutes.', 429)
    res.headers.set('Retry-After', String(lock.retryAfterSec))
    return res
  }

  const teacher = await prisma.teacher.findUnique({ where: { email } })
  // Always run a bcrypt compare (even for unknown emails) so timing doesn't reveal existence.
  const ok = await verifyPassword(password, teacher?.password ?? DUMMY_BCRYPT_HASH)
  if (!teacher || !ok) {
    recordFailure(key)
    return apiError('Incorrect email or password.', 401)
  }

  recordSuccess(key)
  await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
  return json({ ok: true, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } })
}
