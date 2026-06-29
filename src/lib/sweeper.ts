import 'server-only'
import { sweepExpiredMachines, runScheduledBoots, runScheduledShutdowns } from './machines'
import { deliverDueWebhooks } from './webhooks'
import { drainGradeJobs } from './lti-services'

const globalForSweeper = globalThis as unknown as { rcdSweeper?: NodeJS.Timeout }

/** Starts a single in-process interval that enforces time limits and fires schedules. */
export function startSweeper() {
  if (globalForSweeper.rcdSweeper) return
  globalForSweeper.rcdSweeper = setInterval(async () => {
    try {
      const res = await sweepExpiredMachines()
      if (res.expired || res.stuck) {
        console.log(`[sweeper] expired=${res.expired} stuck=${res.stuck}`)
      }
    } catch (err) {
      console.error('[sweeper] sweep error', err)
    }
    try {
      const fired = await runScheduledBoots()
      if (fired) console.log(`[sweeper] fired ${fired} scheduled class boot(s)`)
    } catch (err) {
      console.error('[sweeper] schedule error', err)
    }
    try {
      const off = await runScheduledShutdowns()
      if (off) console.log(`[sweeper] fired ${off} scheduled class shutdown(s)`)
    } catch (err) {
      console.error('[sweeper] bell-shutdown error', err)
    }
    try {
      const delivered = await deliverDueWebhooks()
      if (delivered) console.log(`[sweeper] processed ${delivered} webhook deliver(y/ies)`)
    } catch (err) {
      console.error('[sweeper] webhook error', err)
    }
    try {
      const graded = await drainGradeJobs()
      if (graded) console.log(`[sweeper] processed ${graded} LTI grade job(s)`)
    } catch (err) {
      console.error('[sweeper] grade-passback error', err)
    }
  }, 30_000)
  console.log('[sweeper] started (30s interval)')
}
