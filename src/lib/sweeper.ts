import 'server-only'
import { sweepExpiredMachines } from './machines'

const globalForSweeper = globalThis as unknown as { rcdSweeper?: NodeJS.Timeout }

/** Starts a single in-process interval that enforces machine time limits. */
export function startSweeper() {
  if (globalForSweeper.rcdSweeper) return
  globalForSweeper.rcdSweeper = setInterval(async () => {
    try {
      const res = await sweepExpiredMachines()
      if (res.expired || res.stuck) {
        console.log(`[sweeper] expired=${res.expired} stuck=${res.stuck}`)
      }
    } catch (err) {
      console.error('[sweeper] error', err)
    }
  }, 30_000)
  console.log('[sweeper] started (30s interval)')
}
