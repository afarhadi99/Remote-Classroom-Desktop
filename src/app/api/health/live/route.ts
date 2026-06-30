import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Liveness: the process is up and serving. Always 200 (no dependency checks).
export function GET() {
  return NextResponse.json({ status: 'ok' })
}
