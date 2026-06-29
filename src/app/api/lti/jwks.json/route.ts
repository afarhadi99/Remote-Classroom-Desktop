import { NextResponse } from 'next/server'
import { toolJwks } from '@/lib/lti'

// GET /api/lti/jwks.json — the tool's public keys, fetched by the LMS to verify our JWTs.
export async function GET() {
  return NextResponse.json(await toolJwks())
}
