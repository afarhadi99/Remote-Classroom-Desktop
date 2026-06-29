import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'

// GET /api/teacher/webhooks/{id}/... not used; this file handles delete + recent deliveries.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, teacherId: teacher.id } })
  if (!endpoint) return apiError('Endpoint not found.', 404)

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
  return json({
    deliveries: deliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      status: d.status,
      attempts: d.attempts,
      responseCode: d.responseCode,
      createdAt: d.createdAt.toISOString(),
    })),
  })
}

// DELETE /api/teacher/webhooks/{id}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, teacherId: teacher.id } })
  if (!endpoint) return apiError('Endpoint not found.', 404)
  await prisma.webhookEndpoint.delete({ where: { id } })
  return json({ ok: true })
}
