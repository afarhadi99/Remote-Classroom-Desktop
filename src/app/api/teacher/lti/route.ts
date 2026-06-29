import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

export const dynamic = 'force-dynamic'

// GET /api/teacher/lti — list registered LMS platforms (org-level integration config).
export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const platforms = await prisma.ltiPlatform.findMany({ orderBy: { createdAt: 'desc' } })
  return json({
    platforms: platforms.map((p) => ({
      id: p.id,
      issuer: p.issuer,
      clientId: p.clientId,
      authLoginUrl: p.authLoginUrl,
      jwksUrl: p.jwksUrl,
      deploymentIds: p.deploymentIds.split(',').filter(Boolean),
    })),
  })
}

const schema = z.object({
  issuer: z.string().trim().min(1).max(500),
  clientId: z.string().trim().min(1).max(200),
  authLoginUrl: z.string().url().max(500),
  authTokenUrl: z.string().url().max(500),
  jwksUrl: z.string().url().max(500),
  deploymentIds: z.string().trim().min(1).max(500),
})

// POST /api/teacher/lti — register a platform (Canvas/Schoology/Moodle/Blackboard/D2L).
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Provide issuer, client ID, the platform OIDC/token/JWKS URLs and deployment id(s).')

  const p = await prisma.ltiPlatform.upsert({
    where: { issuer_clientId: { issuer: parsed.data.issuer, clientId: parsed.data.clientId } },
    update: {
      authLoginUrl: parsed.data.authLoginUrl,
      authTokenUrl: parsed.data.authTokenUrl,
      jwksUrl: parsed.data.jwksUrl,
      deploymentIds: parsed.data.deploymentIds,
    },
    create: parsed.data,
  })
  return json({ ok: true, id: p.id }, 201)
}
