import { json } from '@/lib/api'
import { sweepExpiredMachines, runScheduledBoots, runScheduledShutdowns } from '@/lib/machines'
import { deliverDueWebhooks } from '@/lib/webhooks'

// Enforce hard time limits + fire due schedules + flush the webhook queue. Called by the
// in-process sweeper and can also be hit by an external cron for serverless deployments.
async function run() {
  const res = await sweepExpiredMachines()
  const fired = await runScheduledBoots()
  const shutdowns = await runScheduledShutdowns()
  const webhooks = await deliverDueWebhooks()
  return { ok: true, ...res, scheduledBoots: fired, scheduledShutdowns: shutdowns, webhooksProcessed: webhooks }
}

export async function GET() {
  return json(await run())
}

export async function POST() {
  return json(await run())
}
