import { json } from '@/lib/api'
import { sweepExpiredMachines } from '@/lib/machines'

// Enforce hard time limits. Called by the in-process sweeper and can also be hit
// by an external cron (e.g. a platform scheduler) for serverless deployments.
export async function GET() {
  const res = await sweepExpiredMachines()
  return json({ ok: true, ...res })
}

export async function POST() {
  const res = await sweepExpiredMachines()
  return json({ ok: true, ...res })
}
