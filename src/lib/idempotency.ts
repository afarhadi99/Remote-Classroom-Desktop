import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'

/**
 * Wraps a mutating API computation so client retries carrying the same `Idempotency-Key`
 * header (scoped to the calling API key) return the original response instead of re-running.
 * Only 2xx responses are cached — errors stay retryable. No header => runs normally.
 *
 * Single-process best-effort: a true simultaneous race could double-run before either stores,
 * but the unique (keyId, idemKey) index prevents a duplicate cache entry and the common case
 * (a client retrying after a timeout) is fully deduplicated.
 */
export async function idempotent(
  req: Request,
  keyId: string,
  compute: () => Promise<{ status: number; data: unknown }>,
): Promise<Response> {
  const idemKey = req.headers.get('idempotency-key')?.trim()
  if (!idemKey) {
    const { status, data } = await compute()
    return NextResponse.json(data, { status })
  }

  const existing = await prisma.idempotencyKey
    .findUnique({ where: { keyId_idemKey: { keyId, idemKey } } })
    .catch(() => null)
  if (existing) {
    return NextResponse.json(JSON.parse(existing.responseBody), {
      status: existing.statusCode,
      headers: { 'Idempotent-Replayed': 'true' },
    })
  }

  const { status, data } = await compute()
  if (status >= 200 && status < 300) {
    await prisma.idempotencyKey
      .create({
        data: { keyId, idemKey, method: req.method, path: new URL(req.url).pathname, statusCode: status, responseBody: JSON.stringify(data) },
      })
      .catch(() => {}) // lost a race — the other writer cached it
  }
  return NextResponse.json(data, { status })
}
