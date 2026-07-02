// Standalone backend service for split hosting: the Next.js app runs on Vercel; this
// service runs on Railway (or any plain Node host) and handles the two things Vercel's
// serverless/edge functions can't do — a persistent WebSocket reverse proxy for student
// desktops, and the always-on background sweeper (time limits, scheduled boots/shutdowns,
// webhook delivery, LTI grade sync, orphaned-sandbox reconciliation).
//
// Bundled with esbuild for deployment (see scripts/build-railway.mjs) so relative imports
// without extensions and the 'server-only' marker package (aliased to an empty module —
// this process is plain Node, not a Next.js build, so the marker's guard is moot) resolve
// correctly. Can also be run directly in dev via `node --conditions=react-server` since
// Node's native TypeScript support handles everything else.
import { createServer } from 'node:http'
import { PrismaClient } from '@prisma/client'
import { createDesktopAuthorizer, attachDesktopProxy } from '../src/lib/desktop-proxy'
import { startSweeper } from '../src/lib/sweeper'

const port = parseInt(process.env.PORT || '8080', 10)
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'insecure-dev-secret')

const prisma = new PrismaClient()
const authorizeDesktop = createDesktopAuthorizer(prisma, SECRET)

const server = createServer()
attachDesktopProxy(server, authorizeDesktop, (req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

startSweeper()

server.listen(port, () => {
  console.log(`> Remote Classroom desktop-proxy service ready on :${port}`)
})
