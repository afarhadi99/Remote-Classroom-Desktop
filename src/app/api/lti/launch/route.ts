import { NextResponse } from 'next/server'
import { decodeJwt, jwtVerify, createRemoteJWKSet } from 'jose'
import { prisma } from '@/lib/prisma'
import { hashPassword, setSessionCookie } from '@/lib/auth'
import { generateJoinCode } from '@/lib/utils'
import { LTI, rolesToRole, deploymentAllowed, newOpaque } from '@/lib/lti'

export const dynamic = 'force-dynamic'

function fail(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status })
}

// LTI 1.3 Resource Link launch. The LMS form-POSTs a signed id_token + our state. We verify it
// against the platform's JWKS, enforce nonce/claims/deployment, then JIT-provision and sign in.
export async function POST(req: Request) {
  const origin = new URL(req.url).origin
  const form = await req.formData()
  const idToken = String(form.get('id_token') || '')
  const state = String(form.get('state') || '')
  if (!idToken || !state) return fail('Missing id_token or state.', 400)

  // State is single-use — consume it up front (replay protection).
  const stateRow = await prisma.ltiNonce.findUnique({ where: { state } })
  if (stateRow) await prisma.ltiNonce.delete({ where: { state } }).catch(() => {})
  if (!stateRow || stateRow.expiresAt.getTime() < Date.now()) return fail('Invalid or expired launch state.')

  // Peek (unverified) to find the platform by issuer + audience.
  let peek
  try {
    peek = decodeJwt(idToken)
  } catch {
    return fail('Malformed id_token.')
  }
  const iss = String(peek.iss || '')
  const auds = Array.isArray(peek.aud) ? peek.aud.map(String) : [String(peek.aud || '')]
  const platforms = await prisma.ltiPlatform.findMany({ where: { issuer: iss } })
  const platform = platforms.find((p) => auds.includes(p.clientId))
  if (!platform) return fail('Unknown LTI platform (issuer/client_id not registered).')

  // Cryptographically verify against the platform's published keys.
  let payload
  try {
    const JWKS = createRemoteJWKSet(new URL(platform.jwksUrl))
    const verified = await jwtVerify(idToken, JWKS, { issuer: platform.issuer, audience: platform.clientId })
    payload = verified.payload as Record<string, unknown>
  } catch {
    return fail('id_token signature/claims failed verification.')
  }

  // Replay + message validation.
  if (payload.nonce !== stateRow.nonce) return fail('Nonce mismatch.')
  if (payload[LTI.messageType] !== 'LtiResourceLinkRequest') return fail('Unsupported LTI message type.')
  if (payload[LTI.version] !== '1.3.0') return fail('Unsupported LTI version.')
  const deploymentId = String(payload[LTI.deploymentId] || '')
  if (!deploymentAllowed(platform.deploymentIds, deploymentId)) return fail('Deployment not allowed.')

  const role = rolesToRole(payload[LTI.roles])
  const ctx = (payload[LTI.context] as { id?: string; title?: string } | undefined) || {}
  const contextId = String(ctx.id || (payload[LTI.resourceLink] as { id?: string })?.id || 'lti-context')
  const title = String(ctx.title || 'LMS Class').slice(0, 80)
  const displayName = String(
    payload.name ||
      `${(payload.given_name as string) || ''} ${(payload.family_name as string) || ''}`.trim() ||
      (role === 'teacher' ? 'Instructor' : 'Student'),
  ).slice(0, 80)
  const sub = String(payload.sub || '')

  if (role === 'teacher') {
    let teacher = await prisma.teacher.findFirst({ where: { ltiPlatformId: platform.id, ltiSub: sub } })
    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: {
          name: displayName,
          email: `lti_${platform.id}_${sub}@lti.local`.slice(0, 180),
          password: await hashPassword(newOpaque()),
          ltiPlatformId: platform.id,
          ltiSub: sub,
        },
      })
    }
    let classroom = await prisma.classroom.findUnique({
      where: { ltiPlatformId_ltiContextId: { ltiPlatformId: platform.id, ltiContextId: contextId } },
    })
    if (!classroom) {
      let joinCode = generateJoinCode()
      for (let i = 0; i < 5; i++) {
        if (!(await prisma.classroom.findUnique({ where: { joinCode } }))) break
        joinCode = generateJoinCode()
      }
      classroom = await prisma.classroom.create({
        data: { teacherId: teacher.id, name: title, joinCode, ltiPlatformId: platform.id, ltiContextId: contextId },
      })
    }
    await setSessionCookie({ role: 'teacher', id: teacher.id, name: teacher.name, email: teacher.email })
    return NextResponse.redirect(`${origin}/teacher/class/${classroom.id}`, 302)
  }

  // Learner: the class must already exist (an instructor launches/configures first).
  const classroom = await prisma.classroom.findUnique({
    where: { ltiPlatformId_ltiContextId: { ltiPlatformId: platform.id, ltiContextId: contextId } },
  })
  if (!classroom) return fail('This activity is not set up yet — ask your teacher to open it first.', 409)

  let student = await prisma.student.findUnique({
    where: { classroomId_name: { classroomId: classroom.id, name: displayName } },
  })
  if (!student) {
    student = await prisma.student.create({ data: { classroomId: classroom.id, name: displayName } })
  } else if (student.archivedAt) {
    await prisma.student.update({ where: { id: student.id }, data: { archivedAt: null } })
  }
  await setSessionCookie({ role: 'student', id: student.id, name: student.name, classroomId: classroom.id })
  return NextResponse.redirect(`${origin}/student`, 302)
}
