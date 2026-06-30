// Client-safe helpers for the quiet-hours / allowed-boot window (minute-of-day, local time).

export function minuteOfDay(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** True if `m` falls within [start, end). Null bounds = always open. Supports overnight wrap. */
export function withinBootWindow(start: number | null, end: number | null, m: number): boolean {
  if (start == null || end == null) return true
  if (start === end) return true
  return start < end ? m >= start && m < end : m >= start || m < end
}

export function formatMinute(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  const am = h < 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}
