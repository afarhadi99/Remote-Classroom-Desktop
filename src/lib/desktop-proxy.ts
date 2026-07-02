// Shared AUTHENTICATED same-origin-or-cross-origin reverse proxy for Daytona desktop
// previews. Used by BOTH the local custom server (server.mjs) and the standalone Railway
// proxy service in production (split hosting: Next.js app on Vercel, this proxy +
// background sweeper on Railway).
//
// Deliberately self-contained: no 'server-only' import, no local relative runtime imports
// (only npm packages and type-only imports, which are erased), so this file can be
// executed directly by plain Node (server.mjs, no bundler) as well as bundled for the
// Railway deployment.
//
// Desktops are PRIVATE Daytona sandboxes. They are reachable ONLY through this proxy,
// which (1) requires either a valid rcd_session cookie OR a valid short-lived signed
// desktop-access token (query param `dtok`, for when the proxy runs on a different origin
// than the app and cookies aren't sent cross-site), and (2) authorizes the caller against
// the specific sandbox. Both the HTTP path and the WebSocket upgrade (/websockify) are
// gated, so view-only is a UX nicety — access itself is enforced server-side.
import httpProxy from 'http-proxy'
import { jwtVerify } from 'jose'
import type { IncomingMessage, ServerResponse, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Socket } from 'node:net'
import type { PrismaClient } from '@prisma/client'

const DESKTOP_PREFIX = '/desktop/'
const COOKIE_NAME = 'rcd_session'
// Only allow proxying to Daytona preview hosts (prevents this from being an open proxy).
const ALLOWED_HOST = /^[a-z0-9-]+\.(daytonaproxy\d*\.net|proxy\.daytona\.works|daytona\.work)$/i

interface AuthResult {
  ok: boolean
}
type Authorizer = (req: IncomingMessage, sandboxId: string) => Promise<AuthResult>
type FallbackRequest = (req: IncomingMessage, res: ServerResponse) => void
type FallbackUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => void

export const desktopProxy = httpProxy.createProxyServer({ changeOrigin: true, secure: true, ws: true, xfwd: false })

function injectUpstreamHeaders(proxyReq: { setHeader: (name: string, value: string) => void }) {
  proxyReq.setHeader('X-Daytona-Skip-Preview-Warning', 'true')
}
desktopProxy.on('proxyReq', injectUpstreamHeaders)
desktopProxy.on('proxyReqWs', injectUpstreamHeaders)
desktopProxy.on('proxyRes', (proxyRes) => {
  // Strip framing restrictions so the desktop renders inside our (possibly cross-origin) iframe.
  delete proxyRes.headers['x-frame-options']
  delete proxyRes.headers['content-security-policy']
  delete proxyRes.headers['content-security-policy-report-only']
  proxyRes.headers['access-control-allow-origin'] = '*'
})
desktopProxy.on('error', (err, _req, res) => {
  try {
    if (res && 'writeHead' in res && !res.headersSent) {
      ;(res as ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Desktop proxy error: ' + err.message)
    } else if (res && 'destroy' in res) {
      ;(res as Socket).destroy()
    }
  } catch {
    /* ignore */
  }
})

/** Parse "/desktop/<host>/<rest>" -> { targetHost, sandboxId, rewrittenUrl } or null. */
export function parseDesktopUrl(rawUrl: string | undefined) {
  if (!rawUrl || !rawUrl.startsWith(DESKTOP_PREFIX)) return null
  const rest = rawUrl.slice(DESKTOP_PREFIX.length)
  const slash = rest.indexOf('/')
  const host = slash === -1 ? rest : rest.slice(0, slash)
  const tail = slash === -1 ? '/' : rest.slice(slash)
  if (!ALLOWED_HOST.test(host)) return null
  const sandboxId = host.split('.')[0].replace(/^\d+-/, '')
  return { targetHost: host, sandboxId, rewrittenUrl: tail || '/' }
}

function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

function readQueryParam(rawUrl: string | undefined, name: string): string | null {
  if (!rawUrl) return null
  const q = rawUrl.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(rawUrl.slice(q + 1)).get(name)
}

async function verifyDesktopToken(token: string | null, sandboxId: string, secret: Uint8Array): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.sid === sandboxId
  } catch {
    return false
  }
}

/**
 * Builds an authorizer bound to a given Prisma client + JWT secret. Short-lived
 * positive/negative cache avoids hammering the DB on every proxy request (noVNC polls
 * frequently once connected).
 */
export function createDesktopAuthorizer(prisma: PrismaClient, jwtSecretBytes: Uint8Array): Authorizer {
  const authzCache = new Map<string, { value: AuthResult; exp: number }>()
  const POS_TTL = 30_000
  const NEG_TTL = 8_000

  return async function authorizeDesktop(req, sandboxId) {
    // Cross-origin path: a signed, sandbox-scoped token in the query string.
    const dtok = readQueryParam(req.url, 'dtok')
    if (dtok && (await verifyDesktopToken(dtok, sandboxId, jwtSecretBytes))) {
      return { ok: true }
    }

    // Same-origin path: the session cookie (works when app + proxy share an origin).
    const token = readCookie(req, COOKIE_NAME)
    if (!token) return { ok: false }

    let session: { role: string; id: string; classroomId?: string }
    try {
      const { payload } = await jwtVerify(token, jwtSecretBytes)
      if (payload.role !== 'teacher' && payload.role !== 'student' && payload.role !== 'admin') return { ok: false }
      session = payload as typeof session
    } catch {
      return { ok: false }
    }

    const cacheKey = `${session.role}:${session.id}:${sandboxId}`
    const cached = authzCache.get(cacheKey)
    if (cached && cached.exp > Date.now()) return cached.value

    let value: AuthResult = { ok: false }
    try {
      const machine = await prisma.machine.findFirst({
        where: { sandboxId },
        include: { classroom: true },
      })
      if (machine) {
        let authorized =
          // Platform super-admin may view any desktop for oversight.
          session.role === 'admin' ||
          (session.role === 'teacher' && machine.classroom.teacherId === session.id) ||
          (session.role === 'student' && machine.studentId === session.id) ||
          // Broadcast: any student in the class may view the currently-spotlighted desktop.
          (session.role === 'student' &&
            machine.classroomId === session.classroomId &&
            machine.classroom.spotlightMachineId === machine.id)

        // Group workstation: any member of the group may open the shared desktop.
        if (!authorized && session.role === 'student' && machine.groupId) {
          const student = await prisma.student.findUnique({
            where: { id: session.id },
            select: { groupId: true },
          })
          if (student?.groupId && student.groupId === machine.groupId) authorized = true
        }

        if (authorized) value = { ok: true }
      }
    } catch (err) {
      console.error('[proxy authz] error', err)
      return { ok: false } // fail closed, don't cache transient errors
    }

    authzCache.set(cacheKey, { value, exp: Date.now() + (value.ok ? POS_TTL : NEG_TTL) })
    return value
  }
}

/**
 * Wires up the /desktop/* HTTP + WebSocket-upgrade routes on a raw http.Server. Requests
 * that don't match /desktop/* fall through to `fallbackRequest`/`fallbackUpgrade` (e.g.
 * Next.js's own handler in server.mjs; a 404 in the standalone Railway proxy).
 */
export function attachDesktopProxy(
  server: Server,
  authorizeDesktop: Authorizer,
  fallbackRequest?: FallbackRequest,
  fallbackUpgrade?: FallbackUpgrade,
) {
  server.on('request', async (req, res) => {
    const parsed = parseDesktopUrl(req.url)
    if (!parsed) {
      if (fallbackRequest) fallbackRequest(req, res)
      return
    }
    const auth = await authorizeDesktop(req, parsed.sandboxId)
    if (!auth.ok) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Not authorized to access this desktop.')
      return
    }
    req.url = parsed.rewrittenUrl
    desktopProxy.web(req, res, { target: `https://${parsed.targetHost}` })
  })

  server.on('upgrade', async (req, socket, head) => {
    const parsed = parseDesktopUrl(req.url)
    if (parsed) {
      const auth = await authorizeDesktop(req, parsed.sandboxId)
      if (!auth.ok) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      req.url = parsed.rewrittenUrl
      desktopProxy.ws(req, socket, head, { target: `https://${parsed.targetHost}` })
      return
    }
    if (fallbackUpgrade) fallbackUpgrade(req, socket, head)
  })
}
