// Custom Next.js server with a same-origin reverse proxy for Daytona desktop previews.
//
// Daytona shows a one-time "Preview URL Warning" interstitial for public preview links.
// To give students a clean, warning-free desktop, we proxy the noVNC page, its assets and
// the VNC WebSocket through this server and inject the documented
// `X-Daytona-Skip-Preview-Warning: true` header on every upstream request.
//
// Desktop URLs look like:  /desktop/6080-<sandboxId>.daytonaproxy01.net/vnc.html?...
// which we forward to:     https://6080-<sandboxId>.daytonaproxy01.net/vnc.html?...

import { createServer } from 'node:http'
import next from 'next'
import httpProxy from 'http-proxy'

const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || 'localhost'

const DESKTOP_PREFIX = '/desktop/'
// Only allow proxying to Daytona preview hosts (prevents this from being an open proxy).
const ALLOWED_HOST = /^[a-z0-9-]+\.(daytonaproxy\d*\.net|proxy\.daytona\.works|daytona\.work)$/i

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: true,
  ws: true,
  xfwd: false,
})

proxy.on('proxyReq', (proxyReq) => {
  proxyReq.setHeader('X-Daytona-Skip-Preview-Warning', 'true')
})
proxy.on('proxyReqWs', (proxyReq) => {
  proxyReq.setHeader('X-Daytona-Skip-Preview-Warning', 'true')
})
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

// Parse "/desktop/<host>/<rest>" -> { targetHost, rewrittenUrl } or null.
function parseDesktopUrl(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(DESKTOP_PREFIX)) return null
  const rest = rawUrl.slice(DESKTOP_PREFIX.length)
  const slash = rest.indexOf('/')
  const host = slash === -1 ? rest : rest.slice(0, slash)
  const tail = slash === -1 ? '/' : rest.slice(slash)
  if (!ALLOWED_HOST.test(host)) return null
  return { targetHost: host, rewrittenUrl: tail || '/' }
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

const server = createServer((req, res) => {
  const parsed = parseDesktopUrl(req.url)
  if (parsed) {
    req.url = parsed.rewrittenUrl
    proxy.web(req, res, { target: `https://${parsed.targetHost}` })
    return
  }
  handle(req, res)
})

server.on('upgrade', (req, socket, head) => {
  const parsed = parseDesktopUrl(req.url)
  if (parsed) {
    req.url = parsed.rewrittenUrl
    proxy.ws(req, socket, head, { target: `https://${parsed.targetHost}` })
    return
  }
  // let Next handle its own upgrades (HMR in dev)
  const upgradeHandler = app.getUpgradeHandler?.()
  if (upgradeHandler) upgradeHandler(req, socket, head)
})

server.listen(port, () => {
  console.log(`> Remote Classroom Desktop ready on http://${hostname}:${port} (dev=${dev})`)
})
