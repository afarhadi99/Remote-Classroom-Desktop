import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { LTI, getToolPrivateKey } from '@/lib/lti'

const schema = z.object({ classId: z.string().min(1) })

// Teacher picked a class to embed. Build a signed LTI Deep Linking *response* JWT (content item
// pointing at our launch URL) for the browser to POST back to the LMS's return URL.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const session = await prisma.ltiDeepLinkSession.findUnique({ where: { id } })
  if (!session || session.teacherId !== teacher.id) return apiError('Deep link session not found.', 404)
  if (session.usedAt) return apiError('This deep link was already created.', 409)
  if (session.expiresAt.getTime() < Date.now()) return apiError('This deep link session expired.', 410)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Pick a class.')
  const classroom = await prisma.classroom.findFirst({ where: { id: parsed.data.classId, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const platform = await prisma.ltiPlatform.findUnique({ where: { id: session.platformId } })
  if (!platform) return apiError('Platform not found.', 404)

  const origin = new URL(req.url).origin
  const contentItems = [
    {
      type: 'ltiResourceLink',
      url: `${origin}/api/lti/launch`,
      title: classroom.name,
      custom: { rcd_class_id: classroom.id },
    },
  ]

  const { kid, privateKey } = await getToolPrivateKey()
  const jwt = await new SignJWT({
    [LTI.messageType]: 'LtiDeepLinkingResponse',
    [LTI.version]: '1.3.0',
    [LTI.deploymentId]: session.deploymentId,
    [LTI.deepLinkingContentItems]: contentItems,
    ...(session.data ? { [LTI.deepLinkingData]: session.data } : {}),
    nonce: randomBytes(16).toString('hex'),
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(platform.clientId)
    .setAudience(platform.issuer)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

  await prisma.ltiDeepLinkSession.update({ where: { id }, data: { usedAt: new Date() } })
  return json({ jwt, returnUrl: session.returnUrl, className: classroom.name })
}
