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
import { PrismaClient } from '@prisma/client'
import { createDesktopAuthorizer, attachDesktopProxy } from './src/lib/desktop-proxy.ts'

const dev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || 'localhost'

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

// process.env is populated with .env by Next during prepare().
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'insecure-dev-secret')
const prisma = new PrismaClient()
const authorizeDesktop = createDesktopAuthorizer(prisma, SECRET)

const server = createServer()
attachDesktopProxy(
  server,
  authorizeDesktop,
  (req, res) => handle(req, res),
  (req, socket, head) => app.getUpgradeHandler?.()(req, socket, head),
)

server.listen(port, () => {
  console.log(`> Remote Classroom Desktop ready on http://${hostname}:${port} (dev=${dev})`)
})
