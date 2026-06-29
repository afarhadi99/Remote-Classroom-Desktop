import { z } from 'zod'
import { apiError, getTeacher, json } from '@/lib/api'
import { resendDelivery } from '@/lib/webhooks'

const schema = z.object({ deliveryId: z.string().min(1) })

// POST /api/teacher/webhooks/resend — re-queue a delivery for an immediate attempt.
export async function POST(req: Request) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Missing deliveryId.')
  const ok = await resendDelivery(parsed.data.deliveryId, teacher.id)
  if (!ok) return apiError('Delivery not found.', 404)
  return json({ ok: true })
}
