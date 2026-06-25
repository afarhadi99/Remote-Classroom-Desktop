import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

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

export type SessionUser = TeacherSession | StudentSession

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
    if (payload.role === 'teacher' || payload.role === 'student') {
      return payload as unknown as SessionUser
    }
    return null
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
