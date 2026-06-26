// Custom Next.js server with an AUTHENTICATED same-origin reverse proxy for Daytona
// desktop previews.
//
// Desktops are PRIVATE Daytona sandboxes. They are reachable ONLY through this proxy,
// which (1) requires a valid rcd_session cookie, (2) authorizes the caller against the
// specific sandbox (the owning student, or the teacher of that student's class), and
// (3) injects the Daytona private-preview token + skip-warning header upstream. Both the
// HTTP path and the WebSocket upgrade (/websockify) are gated, so view-only is a UX nicety
// — access itself is enforced server-side.
//
// Desktop URLs look like:  /desktop/6080-<sandboxId>.daytonaproxy01.net/vnc.html?...
// which we forward to:     https://6080-<sandboxId>.daytonaproxy01.net/vnc.html?...

import { createServer } from 'node:http'
import next from 'next'
import httpProxy from 'http-proxy'
import { jwtVerify } from 'jose'
import { PrismaClient } from '@prisma/client'

const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || 'localhost'

const DESKTOP_PREFIX = '/desktop/'
const COOKIE_NAME = 'rcd_session'
// Only allow proxying to Daytona preview hosts (prevents this from being an open proxy).
const ALLOWED_HOST = /^[a-z0-9-]+\.(daytonaproxy\d*\.net|proxy\.daytona\.works|daytona\.work)$/i

const proxy = httpProxy.createProxyServer({ changeOrigin: true, secure: true, ws: true, xfwd: false })

function injectUpstreamHeaders(proxyReq) {
  proxyReq.setHeader('X-Daytona-Skip-Preview-Warning', 'true')
}
proxy.on('proxyReq', injectUpstreamHeaders)
proxy.on('proxyReqWs', injectUpstreamHeaders)
proxy.on('proxyRes', (proxyRes) => {
  // Strip framing restrictions so the desktop renders inside our same-origin iframe.
  delete proxyRes.headers['x-frame-options']
  delete proxyRes.headers['content-security-policy']
  delete proxyRes.headers['content-security-policy-report-only']
})
proxy.on('error', (err, _req, res) => {
  try {
    if (res && 'writeHead' in res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Desktop proxy error: ' + err.message)
    } else if (res && 'destroy' in res) {
      res.destroy()
    }
  } catch {
    /* ignore */
  }
})

// Parse "/desktop/<host>/<rest>" -> { targetHost, sandboxId, rewrittenUrl } or null.
function parseDesktopUrl(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(DESKTOP_PREFIX)) return null
  const rest = rawUrl.slice(DESKTOP_PREFIX.length)
  const slash = rest.indexOf('/')
  const host = slash === -1 ? rest : rest.slice(0, slash)
  const tail = slash === -1 ? '/' : rest.slice(slash)
  if (!ALLOWED_HOST.test(host)) return null
  const sandboxId = host.split('.')[0].replace(/^\d+-/, '')
  return { targetHost: host, sandboxId, rewrittenUrl: tail || '/' }
}

function readCookie(req, name) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

// process.env is populated with .env by Next during prepare().
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'insecure-dev-secret')
const prisma = new PrismaClient()

// Short-lived authorization cache: `${role}:${userId}:${sandboxId}` -> { ok, token, exp }
const authzCache = new Map()
const POS_TTL = 30_000
const NEG_TTL = 8_000

async function authorizeDesktop(req, sandboxId) {
  const token = readCookie(req, COOKIE_NAME)
  if (!token) return { ok: false }

  let session
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.role !== 'teacher' && payload.role !== 'student') return { ok: false }
    session = payload
  } catch {
    return { ok: false }
  }

  const cacheKey = `${session.role}:${session.id}:${sandboxId}`
  const cached = authzCache.get(cacheKey)
  if (cached && cached.exp > Date.now()) return cached.value

  let value = { ok: false }
  try {
    const machine = await prisma.machine.findFirst({
      where: { sandboxId },
      include: { classroom: true },
    })
    if (machine) {
      const authorized =
        (session.role === 'teacher' && machine.classroom.teacherId === session.id) ||
        (session.role === 'student' && machine.studentId === session.id) ||
        // Broadcast: any student in the class may view the currently-spotlighted desktop.
        (session.role === 'student' &&
          machine.classroomId === session.classroomId &&
          machine.classroom.spotlightMachineId === machine.id)
      if (authorized) value = { ok: true }
    }
  } catch (err) {
    console.error('[proxy authz] error', err)
    return { ok: false } // fail closed, don't cache transient errors
  }

  authzCache.set(cacheKey, { value, exp: Date.now() + (value.ok ? POS_TTL : NEG_TTL) })
  return value
}

const server = createServer(async (req, res) => {
  const parsed = parseDesktopUrl(req.url)
  if (parsed) {
    const auth = await authorizeDesktop(req, parsed.sandboxId)
    if (!auth.ok) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Not authorized to access this desktop.')
      return
    }
    req.url = parsed.rewrittenUrl
    proxy.web(req, res, { target: `https://${parsed.targetHost}` })
    return
  }
  handle(req, res)
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
    proxy.ws(req, socket, head, { target: `https://${parsed.targetHost}` })
    return
  }
  const upgradeHandler = app.getUpgradeHandler?.()
  if (upgradeHandler) upgradeHandler(req, socket, head)
})

server.listen(port, () => {
  console.log(`> Remote Classroom Desktop ready on http://${hostname}:${port} (dev=${dev})`)
})
