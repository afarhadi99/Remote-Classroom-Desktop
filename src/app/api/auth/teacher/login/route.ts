import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, setSessionCookie } from '@/lib/auth'
import { apiError, json } from '@/lib/api'

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Enter your email and password.')

  const { email, password } = parsed.data
  const teacher = await prisma.teacher.findUnique({ where: { email } })
  if (!teacher || !(await verifyPassword(password, teacher.password))) {
    return apiError('Incorrect email or password.', 401)
  }

  await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
  return json({ ok: true, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } })
}
