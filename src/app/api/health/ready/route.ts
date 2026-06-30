import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Readiness: can we actually serve traffic? Checks Postgres and that the background sweeper
// has run recently. 200 when healthy, 503 (degraded) otherwise — per-subsystem detail in JSON.
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }> = {}

  // Postgres
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, latencyMs: Date.now() - t0 }
  } catch (e) {
    checks.database = { ok: false, detail: (e as Error).message.slice(0, 120) }
  }

  // Sweeper heartbeat — stale if it hasn't finished a tick in the last ~2 minutes.
  try {
    const hb = await prisma.sweeperRun.findUnique({ where: { id: 'singleton' } })
    const ageMs = hb?.lastFinishedAt ? Date.now() - hb.lastFinishedAt.getTime() : null
    const fresh = ageMs != null && ageMs < 120_000
    checks.sweeper = {
      ok: fresh,
      detail: ageMs == null ? 'no heartbeat yet' : `last tick ${Math.round(ageMs / 1000)}s ago${hb?.lastError ? `; lastError: ${hb.lastError}` : ''}`,
    }
  } catch (e) {
    checks.sweeper = { ok: false, detail: (e as Error).message.slice(0, 120) }
  }

  const ready = Object.values(checks).every((c) => c.ok)
  return NextResponse.json({ status: ready ? 'ready' : 'degraded', checks }, { status: ready ? 200 : 503 })
}
