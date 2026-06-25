import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, setSessionCookie } from '@/lib/auth'
import { apiError, json } from '@/lib/api'

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Please provide a name, valid email and a password (min 6 chars).')

  const { name, email, password } = parsed.data
  const existing = await prisma.teacher.findUnique({ where: { email } })
  if (existing) return apiError('An account with that email already exists.', 409)

  const teacher = await prisma.teacher.create({
    data: { name, email, password: await hashPassword(password) },
  })

  await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
  return json({ ok: true, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } })
}
