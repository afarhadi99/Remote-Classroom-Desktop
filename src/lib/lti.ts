import 'server-only'
import { randomBytes } from 'node:crypto'
import { generateKeyPair, exportJWK, exportPKCS8, importPKCS8, type JWK } from 'jose'
import { prisma } from './prisma'

// LTI 1.3 claim URIs (1EdTech).
export const LTI = {
  messageType: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  version: 'https://purl.imsglobal.org/spec/lti/claim/version',
  deploymentId: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  context: 'https://purl.imsglobal.org/spec/lti/claim/context',
  resourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  deepLinkingSettings: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  deepLinkingContentItems: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  deepLinkingData: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
} as const

export const NONCE_TTL_MS = 5 * 60_000

/** Returns the tool's RSA signing key, generating + persisting it on first use. */
export async function getToolKey(): Promise<{ kid: string; publicJwk: JWK; privatePem: string }> {
  const existing = await prisma.ltiKey.findFirst({ orderBy: { createdAt: 'desc' } })
  if (existing) {
    return { kid: existing.kid, publicJwk: JSON.parse(existing.publicJwk), privatePem: existing.privatePem }
  }
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = (await exportJWK(publicKey)) as JWK
  const kid = randomBytes(8).toString('hex')
  jwk.kid = kid
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  const privatePem = await exportPKCS8(privateKey)
  await prisma.ltiKey.create({ data: { kid, publicJwk: JSON.stringify(jwk), privatePem } })
  return { kid, publicJwk: jwk, privatePem }
}

export async function toolJwks(): Promise<{ keys: JWK[] }> {
  const key = await getToolKey()
  return { keys: [key.publicJwk] }
}

/** Imports the tool's private key for signing (AGS/NRPS client assertions, deep linking). */
export async function getToolPrivateKey() {
  const key = await getToolKey()
  return { kid: key.kid, privateKey: await importPKCS8(key.privatePem, 'RS256') }
}

const INSTRUCTOR_RE = /(Instructor|TeachingAssistant|Administrator|ContentDeveloper|Mentor)\b/i

/** LTI roles claim → our teacher/student split. Anything instructor-ish is a teacher. */
export function rolesToRole(roles: unknown): 'teacher' | 'student' {
  const arr = Array.isArray(roles) ? roles.map(String) : []
  return arr.some((r) => INSTRUCTOR_RE.test(r)) ? 'teacher' : 'student'
}

export function deploymentAllowed(platformDeploymentIds: string, deploymentId: string): boolean {
  return platformDeploymentIds.split(',').map((s) => s.trim()).filter(Boolean).includes(deploymentId)
}

export const newOpaque = () => randomBytes(24).toString('base64url')
