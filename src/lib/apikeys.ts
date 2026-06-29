import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

// Scopes a key can be granted. "*" grants all.
export const API_SCOPES = [
  'classes:read',
  'classes:write',
  'roster:read',
  'roster:write',
  'desktops:write',
  'activity:read',
] as const
export type ApiScope = (typeof API_SCOPES)[number]

export function isApiScope(v: string): v is ApiScope {
  return (API_SCOPES as readonly string[]).includes(v)
}

const PREFIX = 'rcd_sk_'

/** Mints a new secret. Only the SHA-256 hash is ever stored. */
export function generateApiKeySecret(): string {
  return PREFIX + randomBytes(24).toString('base64url')
}
export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}
export function keyDisplay(secret: string): { prefix: string; last4: string } {
  return { prefix: secret.slice(0, PREFIX.length + 4), last4: secret.slice(-4) }
}

// ---- Rate limiting: in-process token bucket per key (no Redis needed) -----
const buckets = new Map<string, { tokens: number; ts: number }>()
const CAPACITY = 60 // burst
const REFILL_PER_SEC = 2 // sustained

function rateLimitOk(keyId: string, now: number): boolean {
  const b = buckets.get(keyId) ?? { tokens: CAPACITY, ts: now }
  const elapsedSec = Math.max(0, (now - b.ts) / 1000)
  b.tokens = Math.min(CAPACITY, b.tokens + elapsedSec * REFILL_PER_SEC)
  b.ts = now
  if (b.tokens < 1) {
    buckets.set(keyId, b)
    return false
  }
  b.tokens -= 1
  buckets.set(keyId, b)
  return true
}

export type ApiCaller =
  | { ok: true; teacherId: string; keyId: string; scopes: string[] }
  | { ok: false; status: number; error: string }

/**
 * Resolves the caller of a public-API request from its `Authorization: Bearer rcd_sk_...`
 * header, enforces the required scope and a per-key rate limit, and bumps lastUsedAt.
 */
export async function getApiCaller(req: Request, requiredScope: ApiScope): Promise<ApiCaller> {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return { ok: false, status: 401, error: 'Missing API key. Send "Authorization: Bearer rcd_sk_...".' }

  const key = await prisma.apiKey.findUnique({ where: { hashedKey: hashApiKey(m[1].trim()) } })
  if (!key || key.revokedAt) return { ok: false, status: 401, error: 'Invalid or revoked API key.' }

  const scopes = key.scopes.split(',').map((s) => s.trim()).filter(Boolean)
  if (!scopes.includes('*') && !scopes.includes(requiredScope)) {
    return { ok: false, status: 403, error: `This API key is missing the required scope "${requiredScope}".` }
  }

  if (!rateLimitOk(key.id, Date.now())) {
    return { ok: false, status: 429, error: 'Rate limit exceeded — slow down and retry.' }
  }

  void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return { ok: true, teacherId: key.teacherId, keyId: key.id, scopes }
}
