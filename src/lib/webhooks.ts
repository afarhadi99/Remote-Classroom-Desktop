import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

export const WEBHOOK_EVENTS = [
  'boot',
  'running',
  'stopped',
  'expired',
  'error',
  'lock',
  'unlock',
  'exam',
  'spotlight',
  'flag',
  'handout',
  'extend',
  'announce',
  'clone',
  'provision_all',
  'shutdown_all',
] as const

// Retry backoff (ms) indexed by attempt number. After the last, the delivery is dead-lettered.
const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60_000_0]
const MAX_ATTEMPTS = BACKOFF_MS.length + 1 // first try + retries
const TIMEOUT_MS = 8_000

export function generateWebhookSecret(): string {
  return 'whsec_' + randomBytes(24).toString('base64url')
}

/** `t=<unix>,v1=<hex hmacSHA256(secret, t + "." + body)>` — Stripe-style signature. */
export function signWebhook(secret: string, body: string, tSec: number): string {
  const v1 = createHmac('sha256', secret).update(`${tSec}.${body}`).digest('hex')
  return `t=${tSec},v1=${v1}`
}

type EventRow = {
  id: string
  classroomId: string
  type: string
  message: string
  actorRole: string | null
  studentId: string | null
  createdAt: Date
}

/**
 * Fans a freshly-logged class event out to every enabled endpoint of the class's teacher that
 * subscribes to it: persists a pending delivery per endpoint, then kicks an immediate attempt.
 */
export async function fanoutEvent(event: EventRow): Promise<void> {
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: event.classroomId },
      select: { name: true, teacherId: true },
    })
    if (!classroom) return
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { teacherId: classroom.teacherId, enabled: true },
    })
    if (endpoints.length === 0) return

    const student = event.studentId
      ? await prisma.student.findUnique({ where: { id: event.studentId }, select: { name: true } })
      : null

    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      message: event.message,
      classId: event.classroomId,
      className: classroom.name,
      studentName: student?.name ?? null,
      actorRole: event.actorRole,
      createdAt: event.createdAt.toISOString(),
    })

    const matched = endpoints.filter((e) => {
      const subs = e.events.split(',').map((s) => s.trim())
      return subs.includes('*') || subs.includes(event.type)
    })
    if (matched.length === 0) return

    await prisma.webhookDelivery.createMany({
      data: matched.map((e) => ({
        endpointId: e.id,
        eventId: event.id,
        eventType: event.type,
        payload,
        status: 'pending',
        nextRetryAt: new Date(),
      })),
    })
    // Best-effort immediate delivery; the sweeper handles retries.
    void deliverDueWebhooks()
  } catch {
    /* webhook fan-out must never break the request */
  }
}

let delivering = false

/** Attempts all due deliveries (pending or failed past their backoff). Safe to call often. */
export async function deliverDueWebhooks(now: Date = new Date()): Promise<number> {
  if (delivering) return 0 // avoid overlapping runs in-process
  delivering = true
  try {
    const due = await prisma.webhookDelivery.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      include: { endpoint: true },
      take: 25,
      orderBy: { createdAt: 'asc' },
    })
    let done = 0
    for (const d of due) {
      await attemptDelivery(d)
      done++
    }
    return done
  } catch {
    return 0
  } finally {
    delivering = false
  }
}

type DeliveryWithEndpoint = {
  id: string
  payload: string
  attempts: number
  eventId: string
  endpoint: { url: string; secret: string; enabled: boolean }
}

async function attemptDelivery(d: DeliveryWithEndpoint): Promise<void> {
  const attemptNo = d.attempts + 1
  const tSec = Math.floor(Date.now() / 1000)
  let code: number | null = null
  let okDelivered = false

  if (!d.endpoint.enabled) {
    await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: 'failed', nextRetryAt: null } }).catch(() => {})
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(d.endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'RemoteClassroomDesktop-Webhooks/1.0',
        'X-RCD-Event-Id': d.eventId,
        'X-RCD-Signature': signWebhook(d.endpoint.secret, d.payload, tSec),
      },
      body: d.payload,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
    code = res.status
    okDelivered = res.status >= 200 && res.status < 300
  } catch {
    okDelivered = false
  }

  if (okDelivered) {
    await prisma.webhookDelivery
      .update({ where: { id: d.id }, data: { status: 'delivered', attempts: attemptNo, responseCode: code, nextRetryAt: null } })
      .catch(() => {})
    return
  }

  if (attemptNo >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery
      .update({ where: { id: d.id }, data: { status: 'dead', attempts: attemptNo, responseCode: code, nextRetryAt: null } })
      .catch(() => {})
    return
  }

  const backoff = BACKOFF_MS[Math.min(attemptNo - 1, BACKOFF_MS.length - 1)]
  await prisma.webhookDelivery
    .update({
      where: { id: d.id },
      data: { status: 'failed', attempts: attemptNo, responseCode: code, nextRetryAt: new Date(Date.now() + backoff) },
    })
    .catch(() => {})
}

/** Manual resend: re-queue a delivery for an immediate attempt. */
export async function resendDelivery(id: string, teacherId: string): Promise<boolean> {
  const d = await prisma.webhookDelivery.findUnique({ where: { id }, include: { endpoint: true } })
  if (!d || d.endpoint.teacherId !== teacherId) return false
  await prisma.webhookDelivery.update({ where: { id }, data: { status: 'pending', nextRetryAt: new Date() } })
  void deliverDueWebhooks()
  return true
}
