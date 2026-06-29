import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { newOpaque, NONCE_TTL_MS } from '@/lib/lti'

export const dynamic = 'force-dynamic'

// OIDC third-party-initiated login. The LMS sends the browser here; we bounce it back to the
// platform's auth endpoint with a state+nonce we persist for the launch step to validate.
async function handle(params: URLSearchParams, origin: string) {
  const iss = params.get('iss')
  const loginHint = params.get('login_hint')
  const clientIdParam = params.get('client_id')
  if (!iss || !loginHint) {
    return NextResponse.json({ error: 'Missing iss/login_hint.' }, { status: 400 })
  }

  const platform = clientIdParam
    ? await prisma.ltiPlatform.findUnique({ where: { issuer_clientId: { issuer: iss, clientId: clientIdParam } } })
    : await prisma.ltiPlatform.findFirst({ where: { issuer: iss } })
  if (!platform) return NextResponse.json({ error: 'Unknown LTI platform (issuer not registered).' }, { status: 400 })

  const state = newOpaque()
  const nonce = newOpaque()
  await prisma.ltiNonce.create({ data: { state, nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) } })

  const auth = new URL(platform.authLoginUrl)
  auth.searchParams.set('scope', 'openid')
  auth.searchParams.set('response_type', 'id_token')
  auth.searchParams.set('response_mode', 'form_post')
  auth.searchParams.set('prompt', 'none')
  auth.searchParams.set('client_id', platform.clientId)
  auth.searchParams.set('redirect_uri', `${origin}/api/lti/launch`)
  auth.searchParams.set('login_hint', loginHint)
  auth.searchParams.set('state', state)
  auth.searchParams.set('nonce', nonce)
  const messageHint = params.get('lti_message_hint')
  if (messageHint) auth.searchParams.set('lti_message_hint', messageHint)

  return NextResponse.redirect(auth.toString(), 302)
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams, new URL(req.url).origin)
}
export async function POST(req: Request) {
  const form = await req.formData()
  const params = new URLSearchParams()
  for (const [k, v] of form.entries()) params.set(k, String(v))
  return handle(params, new URL(req.url).origin)
}
