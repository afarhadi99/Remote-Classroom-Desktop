import 'server-only'
import { randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'
import { prisma } from './prisma'
import { getToolPrivateKey } from './lti'

export const LTI_SCOPES = {
  nrps: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
  lineItem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
} as const

const LINEITEM_CT = 'application/vnd.ims.lti-ags.v2.lineitem+json'
const SCORE_CT = 'application/vnd.ims.lti-ags.v2.score+json'
const MEMBERSHIP_CT = 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'

// ---- OAuth2 client-credentials (signed JWT assertion) --------------------
async function mintAssertion(platform: { clientId: string; authTokenUrl: string }): Promise<string> {
  const { kid, privateKey } = await getToolPrivateKey()
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(platform.clientId)
    .setSubject(platform.clientId)
    .setAudience(platform.authTokenUrl)
    .setIssuedAt()
    .setJti(randomBytes(16).toString('hex'))
    .setExpirationTime('5m')
    .sign(privateKey)
}

/** Gets (and caches) an LTI Advantage service bearer token for the given scopes. */
export async function getServiceToken(platformId: string, scopes: string[]): Promise<string> {
  const scopeKey = [...scopes].sort().join(' ')
  const cached = await prisma.ltiServiceToken.findUnique({
    where: { platformId_scopeKey: { platformId, scopeKey } },
  })
  if (cached && cached.expiresAt.getTime() > Date.now() + 30_000) return cached.accessToken

  const platform = await prisma.ltiPlatform.findUnique({ where: { id: platformId } })
  if (!platform) throw new Error('LTI platform not found.')

  const assertion = await mintAssertion(platform)
  const res = await fetch(platform.authTokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      scope: scopeKey,
    }),
  })
  if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in?: number }
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000)
  await prisma.ltiServiceToken.upsert({
    where: { platformId_scopeKey: { platformId, scopeKey } },
    update: { accessToken: data.access_token, expiresAt },
    create: { platformId, scopeKey, accessToken: data.access_token, expiresAt },
  })
  return data.access_token
}

function nextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i)
    if (m) return m[1]
  }
  return null
}

const isInstructor = (roles: unknown) =>
  Array.isArray(roles) && roles.some((r) => /Instructor|TeachingAssistant|Administrator/i.test(String(r)))

// ---- NRPS: pull LMS course membership into the class ---------------------
export async function nrpsSync(classroomId: string): Promise<{ added: number; updated: number; archived: number }> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } })
  if (!classroom?.ltiPlatformId || !classroom.ltiNrpsUrl) throw new Error('This class is not LTI-linked with a roster service.')

  const token = await getServiceToken(classroom.ltiPlatformId, [LTI_SCOPES.nrps])
  let url: string | null = classroom.ltiNrpsUrl
  const members: { userId: string; name: string }[] = []
  let guard = 0
  while (url && guard++ < 50) {
    const res: Response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: MEMBERSHIP_CT } })
    if (!res.ok) throw new Error(`NRPS returned ${res.status}`)
    const data = (await res.json()) as { members?: { status?: string; user_id: string; roles: string[]; name?: string; given_name?: string; family_name?: string }[] }
    for (const m of data.members ?? []) {
      if (m.status && m.status !== 'Active') continue
      if (isInstructor(m.roles)) continue
      const name = (m.name || `${m.given_name || ''} ${m.family_name || ''}`.trim() || m.user_id).slice(0, 80)
      members.push({ userId: m.user_id, name })
    }
    url = nextLink(res.headers.get('link'))
  }

  const seen = new Set(members.map((m) => m.userId))
  let added = 0
  let updated = 0
  for (const m of members) {
    const existing = await prisma.student.findFirst({ where: { classroomId, ltiUserId: m.userId } })
    if (!existing) {
      await prisma.student.create({ data: { classroomId, name: m.name, ltiUserId: m.userId } }).catch(() => {})
      added++
    } else if (existing.name !== m.name || existing.archivedAt) {
      await prisma.student.update({ where: { id: existing.id }, data: { name: m.name, archivedAt: null } })
      updated++
    }
  }
  // Archive students who were NRPS-synced before but are no longer enrolled.
  const current = await prisma.student.findMany({ where: { classroomId, ltiUserId: { not: null }, archivedAt: null } })
  let archived = 0
  for (const s of current) {
    if (!seen.has(s.ltiUserId!)) {
      await prisma.student.update({ where: { id: s.id }, data: { archivedAt: new Date() } })
      archived++
    }
  }
  return { added, updated, archived }
}

// ---- AGS: push a grade into the LMS gradebook ----------------------------
function scoresUrl(lineItemUrl: string): string {
  const [base, q] = lineItemUrl.split('?')
  return `${base.replace(/\/$/, '')}/scores${q ? `?${q}` : ''}`
}

async function ensureLineItem(classroom: { id: string; ltiPlatformId: string; ltiAgsLineitemsUrl: string }, assignmentId: string, title: string, scoreMaximum: number, token: string): Promise<string> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
  if (assignment?.ltiLineItemUrl) return assignment.ltiLineItemUrl
  const res = await fetch(classroom.ltiAgsLineitemsUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': LINEITEM_CT },
    body: JSON.stringify({ scoreMaximum, label: title, resourceId: assignmentId }),
  })
  if (!res.ok) throw new Error(`Line item create returned ${res.status}`)
  const created = (await res.json()) as { id: string }
  await prisma.assignment.update({ where: { id: assignmentId }, data: { ltiLineItemUrl: created.id } })
  return created.id
}

/** Enqueue a durable grade-passback job (drained by the sweeper). No-op if class isn't AGS-linked. */
export async function enqueueGradePassback(params: {
  classroomId: string
  assignmentId: string
  studentId: string
  scoreGiven: number
  scoreMaximum: number
  comment?: string | null
}): Promise<boolean> {
  const classroom = await prisma.classroom.findUnique({ where: { id: params.classroomId } })
  const student = await prisma.student.findUnique({ where: { id: params.studentId } })
  if (!classroom?.ltiAgsLineitemsUrl || !classroom.ltiPlatformId || !student?.ltiUserId) return false
  await prisma.ltiGradeJob.create({
    data: {
      classroomId: params.classroomId,
      assignmentId: params.assignmentId,
      studentId: params.studentId,
      scoreGiven: params.scoreGiven,
      scoreMaximum: params.scoreMaximum,
      comment: params.comment ?? null,
      status: 'pending',
      nextAttemptAt: new Date(),
    },
  })
  void drainGradeJobs()
  return true
}

const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60_000_0]
const MAX_ATTEMPTS = BACKOFF_MS.length + 1
let draining = false

export async function drainGradeJobs(now: Date = new Date()): Promise<number> {
  if (draining) return 0
  draining = true
  try {
    const due = await prisma.ltiGradeJob.findMany({
      where: { status: { in: ['pending', 'failed'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      take: 25,
      orderBy: { createdAt: 'asc' },
    })
    let n = 0
    for (const job of due) {
      await attemptPassback(job)
      n++
    }
    return n
  } catch {
    return 0
  } finally {
    draining = false
  }
}

async function attemptPassback(job: { id: string; classroomId: string; assignmentId: string; studentId: string; scoreGiven: number; scoreMaximum: number; comment: string | null; attempts: number }): Promise<void> {
  const attemptNo = job.attempts + 1
  try {
    const classroom = await prisma.classroom.findUnique({ where: { id: job.classroomId } })
    const assignment = await prisma.assignment.findUnique({ where: { id: job.assignmentId } })
    const student = await prisma.student.findUnique({ where: { id: job.studentId } })
    if (!classroom?.ltiAgsLineitemsUrl || !classroom.ltiPlatformId || !student?.ltiUserId || !assignment) {
      throw new Error('Class/assignment/student no longer AGS-addressable.')
    }
    const token = await getServiceToken(classroom.ltiPlatformId, [LTI_SCOPES.lineItem, LTI_SCOPES.score])
    const lineItemUrl = await ensureLineItem(
      { id: classroom.id, ltiPlatformId: classroom.ltiPlatformId, ltiAgsLineitemsUrl: classroom.ltiAgsLineitemsUrl },
      job.assignmentId,
      assignment.title,
      job.scoreMaximum,
      token,
    )
    const res = await fetch(scoresUrl(lineItemUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': SCORE_CT },
      body: JSON.stringify({
        userId: student.ltiUserId,
        scoreGiven: job.scoreGiven,
        scoreMaximum: job.scoreMaximum,
        timestamp: new Date().toISOString(),
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        comment: job.comment ?? undefined,
      }),
    })
    if (!res.ok) throw new Error(`Score POST returned ${res.status}`)
    await prisma.ltiGradeJob.update({ where: { id: job.id }, data: { status: 'delivered', attempts: attemptNo, lastError: null, nextAttemptAt: null } })
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300)
    if (attemptNo >= MAX_ATTEMPTS) {
      await prisma.ltiGradeJob.update({ where: { id: job.id }, data: { status: 'dead', attempts: attemptNo, lastError: msg, nextAttemptAt: null } }).catch(() => {})
    } else {
      const backoff = BACKOFF_MS[Math.min(attemptNo - 1, BACKOFF_MS.length - 1)]
      await prisma.ltiGradeJob.update({ where: { id: job.id }, data: { status: 'failed', attempts: attemptNo, lastError: msg, nextAttemptAt: new Date(Date.now() + backoff) } }).catch(() => {})
    }
  }
}
