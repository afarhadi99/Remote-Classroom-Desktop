import { json } from '@/lib/api'
import { sweepExpiredMachines, runScheduledBoots, runScheduledShutdowns } from '@/lib/machines'

// Enforce hard time limits + fire due schedules. Called by the in-process sweeper and
// can also be hit by an external cron (e.g. a platform scheduler) for serverless deployments.
async function run() {
  const res = await sweepExpiredMachines()
  const fired = await runScheduledBoots()
  const shutdowns = await runScheduledShutdowns()
  return { ok: true, ...res, scheduledBoots: fired, scheduledShutdowns: shutdowns }
}

export async function GET() {
  return json(await run())
}

export async function POST() {
  return json(await run())
}
