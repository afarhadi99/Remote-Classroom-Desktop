import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const COOKIE_NAME = 'rcd_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function secretKey() {
  const secret = process.env.JWT_SECRET || 'insecure-dev-secret'
  return new TextEncoder().encode(secret)
}

export type TeacherSession = {
  role: 'teacher'
  id: string
  name: string
  email: string
}

export type StudentSession = {
  role: 'student'
  id: string
  name: string
  classroomId: string
}

export type AdminSession = {
  role: 'admin'
  id: string
  name: string
  email: string
}

export type SessionUser = TeacherSession | StudentSession | AdminSession

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey())
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.role !== 'teacher' && payload.role !== 'student' && payload.role !== 'admin') return null

    // "Sign out everywhere": reject privileged tokens issued before the account's cutoff.
    // Fail-open on a DB error so a transient hiccup never mass-logs-out (the JWT signature is
    // the primary auth; this is a secondary revocation check). Students aren't revocable.
    if ((payload.role === 'teacher' || payload.role === 'admin') && typeof payload.iat === 'number') {
      try {
        const validFrom =
          payload.role === 'teacher'
            ? (await prisma.teacher.findUnique({ where: { id: String(payload.id) }, select: { sessionsValidFrom: true } }))?.sessionsValidFrom
            : (await prisma.admin.findUnique({ where: { id: String(payload.id) }, select: { sessionsValidFrom: true } }))?.sessionsValidFrom
        if (validFrom && payload.iat < Math.floor(validFrom.getTime() / 1000)) return null
      } catch {
        /* fail open */
      }
    }
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// A valid-format bcrypt hash to compare against when a user/student doesn't exist, so login
// timing doesn't leak whether an account exists. The result is always ignored.
export const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MH/rMH7K0z3rNVqOQ1pImQyR0a3wQ8K'
