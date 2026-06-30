import { json } from '@/lib/api'
import { runSweeperTick } from '@/lib/sweeper'

// Enforce hard time limits + fire due schedules/webhooks/grade-jobs, and refresh the sweeper
// heartbeat. Called by the in-process sweeper and can also be hit by an external cron.
export async function GET() {
  return json({ ok: true, ...(await runSweeperTick()) })
}

export async function POST() {
  return json({ ok: true, ...(await runSweeperTick()) })
}
