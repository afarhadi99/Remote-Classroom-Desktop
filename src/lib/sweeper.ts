import 'server-only'
import { prisma } from './prisma'
import { sweepExpiredMachines, runScheduledBoots, runScheduledShutdowns, reconcileDesktops } from './machines'
import { deliverDueWebhooks } from './webhooks'
import { drainGradeJobs } from './lti-services'

const globalForSweeper = globalThis as unknown as { rcdSweeper?: NodeJS.Timeout }
let lastReconcileAt = 0 // ms; 0 => reconcile on the first tick after boot

export interface SweeperResult {
  expired: number
  stuck: number
  scheduledBoots: number
  scheduledShutdowns: number
  webhooksProcessed: number
  gradeJobsProcessed: number
}

/**
 * Runs one full sweep (time limits, schedules, webhooks, grade jobs) and records a heartbeat
 * in SweeperRun so /api/health/ready can detect a dead background loop. Each task is isolated
 * so one failure doesn't abort the rest. Used by both the in-process interval and /api/cron/sweep.
 */
export async function runSweeperTick(): Promise<SweeperResult> {
  const startedAt = new Date()
  const out: SweeperResult = { expired: 0, stuck: 0, scheduledBoots: 0, scheduledShutdowns: 0, webhooksProcessed: 0, gradeJobsProcessed: 0 }
  const errors: string[] = []

  try {
    const res = await sweepExpiredMachines()
    out.expired = res.expired
    out.stuck = res.stuck
  } catch (err) {
    errors.push(`sweep: ${(err as Error).message}`)
  }
  try {
    out.scheduledBoots = await runScheduledBoots()
  } catch (err) {
    errors.push(`boots: ${(err as Error).message}`)
  }
  try {
    out.scheduledShutdowns = await runScheduledShutdowns()
  } catch (err) {
    errors.push(`shutdowns: ${(err as Error).message}`)
  }
  try {
    out.webhooksProcessed = await deliverDueWebhooks()
  } catch (err) {
    errors.push(`webhooks: ${(err as Error).message}`)
  }
  try {
    out.gradeJobsProcessed = await drainGradeJobs()
  } catch (err) {
    errors.push(`grades: ${(err as Error).message}`)
  }
  // Reconcile DB<->Daytona drift, but only every ~10 min (the Daytona list call is heavy).
  try {
    const sinceReconcile = startedAt.getTime() - lastReconcileAt
    if (sinceReconcile > 10 * 60_000) {
      lastReconcileAt = startedAt.getTime()
      const r = await reconcileDesktops()
      if (r.orphansDeleted || r.staleStopped) console.log(`[sweeper] reconcile: orphans=${r.orphansDeleted} stale=${r.staleStopped}`)
    }
  } catch (err) {
    errors.push(`reconcile: ${(err as Error).message}`)
  }

  const finishedAt = new Date()
  await prisma.sweeperRun
    .upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        lastStartedAt: startedAt,
        lastFinishedAt: finishedAt,
        lastError: errors.length ? errors.join('; ').slice(0, 500) : null,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ticks: 1,
      },
      update: {
        lastStartedAt: startedAt,
        lastFinishedAt: finishedAt,
        lastError: errors.length ? errors.join('; ').slice(0, 500) : null,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ticks: { increment: 1 },
      },
    })
    .catch(() => {})

  return out
}

/** Starts a single in-process interval that enforces time limits and fires schedules. */
export function startSweeper() {
  if (globalForSweeper.rcdSweeper) return
  // Run once immediately so the heartbeat is fresh right after boot (and due schedules fire).
  void runSweeperTick().catch((err) => console.error('[sweeper] initial tick error', err))
  globalForSweeper.rcdSweeper = setInterval(() => {
    runSweeperTick().catch((err) => console.error('[sweeper] tick error', err))
  }, 30_000)
  console.log('[sweeper] started (30s interval)')
}
