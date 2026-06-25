// Next.js instrumentation hook — runs once when the server boots.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSweeper } = await import('./lib/sweeper')
    startSweeper()
  }
}
