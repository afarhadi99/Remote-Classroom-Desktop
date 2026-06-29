import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import {
  API_SCOPES,
  isApiScope,
  generateApiKeySecret,
  hashApiKey,
  keyDisplay,
} from '@/lib/apikeys'

export const dynamic = 'force-dynamic'

// GET /api/teacher/api-keys — list this teacher's keys (never the secret).
export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const keys = await prisma.apiKey.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
  })
  return json({
    scopes: API_SCOPES,
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      scopes: k.scopes.split(',').filter(Boolean),
      prefix: k.prefix,
      last4: k.last4,
      revoked: !!k.revokedAt,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    })),
  })
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scopes: z.array(z.string()).min(1).max(API_SCOPES.length + 1),
})

// POST /api/teacher/api-keys — mint a key; the plaintext secret is returned exactly once.
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Provide a name and at least one scope.')

  const requested = parsed.data.scopes
  const scopes = requested.includes('*') ? ['*'] : requested.filter(isApiScope)
  if (scopes.length === 0) return apiError('No valid scopes selected.')

  const secret = generateApiKeySecret()
  const { prefix, last4 } = keyDisplay(secret)
  const key = await prisma.apiKey.create({
    data: {
      teacherId: teacher.id,
      name: parsed.data.name,
      scopes: scopes.join(','),
      hashedKey: hashApiKey(secret),
      prefix,
      last4,
    },
  })
  // The ONLY time the plaintext secret is ever returned.
  return json({ id: key.id, name: key.name, scopes, secret }, 201)
}
