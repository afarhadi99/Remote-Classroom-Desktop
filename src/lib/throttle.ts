import 'server-only'
import { createHash } from 'node:crypto'

// In-process brute-force throttle for unauthenticated entry points (teacher login, student PIN
// join). Same single-process Map approach as the API-key rate limiter — no Redis. Keyed per
// (route, ip, target identifier) so one victim's lockout never affects unrelated accounts.
type Entry = { fails: number; lockedUntil: number; ts: number }
const attempts = new Map<string, Entry>()
const WINDOW_MS = 15 * 60_000
const MAX_FAILS = 10
const LOCK_MS = 15 * 60_000

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'local'
}

export function throttleKey(route: string, ip: string, identifier: string): string {
  return createHash('sha256').update(`${route}|${ip}|${identifier.toLowerCase()}`).digest('hex')
}

/** Call BEFORE verifying the secret. If locked, reject regardless of whether the secret is right. */
export function checkLock(key: string, now = Date.now()): { locked: boolean; retryAfterSec: number } {
  const e = attempts.get(key)
  if (e && e.lockedUntil > now) return { locked: true, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) }
  return { locked: false, retryAfterSec: 0 }
}

/** Record a failed attempt; locks the key once MAX_FAILS is reached within the window. */
export function recordFailure(key: string, now = Date.now()): void {
  const e = attempts.get(key)
  if (!e || now - e.ts > WINDOW_MS) {
    attempts.set(key, { fails: 1, lockedUntil: 0, ts: now })
    return
  }
  e.fails += 1
  e.ts = now
  if (e.fails >= MAX_FAILS) e.lockedUntil = now + LOCK_MS
  attempts.set(key, e)
}

/** Clear on success. */
export function recordSuccess(key: string): void {
  attempts.delete(key)
}
