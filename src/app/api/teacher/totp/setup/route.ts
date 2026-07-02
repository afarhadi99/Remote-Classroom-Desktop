import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { generateTotpSecret, totpAuthUrl } from '@/lib/totp'

// Starts (or restarts) TOTP setup: generates a new secret and stores it un-enabled.
// totpEnabled only flips true once /enable confirms a real code, so an abandoned setup
// never locks the teacher out of their account.
export async function POST() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const secret = generateTotpSecret()
  await prisma.teacher.update({ where: { id: teacher.id }, data: { totpSecret: secret, totpEnabled: false } })

  return json({
    ok: true,
    secret,
    otpauthUrl: totpAuthUrl(secret, teacher.email),
  })
}
