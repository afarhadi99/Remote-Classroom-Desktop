import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { WEBHOOK_EVENTS, generateWebhookSecret } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

// GET /api/teacher/webhooks — list endpoints (secret included; the teacher needs it to verify).
export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
  })
  return json({
    events: WEBHOOK_EVENTS,
    endpoints: endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      secret: e.secret,
      events: e.events.split(',').filter(Boolean),
      enabled: e.enabled,
      createdAt: e.createdAt.toISOString(),
    })),
  })
}

const createSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string()).min(1),
})

// POST /api/teacher/webhooks — register an endpoint (a signing secret is generated).
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Provide a valid https URL and at least one event.')

  const valid = parsed.data.events.includes('*')
    ? ['*']
    : parsed.data.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e))
  if (valid.length === 0) return apiError('No valid events selected.')

  const endpoint = await prisma.webhookEndpoint.create({
    data: { teacherId: teacher.id, url: parsed.data.url, events: valid.join(','), secret: generateWebhookSecret() },
  })
  return json({ id: endpoint.id, secret: endpoint.secret }, 201)
}
