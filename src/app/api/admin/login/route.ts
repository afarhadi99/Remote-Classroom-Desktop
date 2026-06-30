import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, setSessionCookie, DUMMY_BCRYPT_HASH } from '@/lib/auth'
import { apiError, json } from '@/lib/api'
import { clientIp, throttleKey, checkLock, recordFailure, recordSuccess } from '@/lib/throttle'

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

// Platform super-admin login. Same brute-force protections as teacher login.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter your email and password.')

  const { email, password } = parsed.data
  const key = throttleKey('admin-login', clientIp(req), email)
  const lock = checkLock(key)
  if (lock.locked) {
    const res = apiError('Too many attempts. Try again in a few minutes.', 429)
    res.headers.set('Retry-After', String(lock.retryAfterSec))
    return res
  }

  const admin = await prisma.admin.findUnique({ where: { email } })
  const ok = await verifyPassword(password, admin?.password ?? DUMMY_BCRYPT_HASH)
  if (!admin || !ok) {
    recordFailure(key)
    return apiError('Incorrect email or password.', 401)
  }

  recordSuccess(key)
  await setSessionCookie({ role: 'admin', id: admin.id, name: admin.name, email: admin.email })
  return json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email } })
}
