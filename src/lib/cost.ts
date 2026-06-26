import 'server-only'

// Estimated cloud-desktop cost per running minute (USD). Override with the
// DESKTOP_COST_PER_MINUTE env var; default ≈ $0.75 / hour.
export const DESKTOP_COST_PER_MINUTE = Number(process.env.DESKTOP_COST_PER_MINUTE ?? 0.0125)

export function estimateCostCents(minutes: number): number {
  return Math.round(minutes * DESKTOP_COST_PER_MINUTE * 100)
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
