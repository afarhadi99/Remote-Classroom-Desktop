// Deliberately NOT 'server-only': this must also be importable by plain Node contexts
// (the local custom server, and the standalone Railway proxy service in production),
// not just by Next.js server code.
import { SignJWT } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'insecure-dev-secret')

/**
 * Signs a short-lived, sandbox-scoped access token embedded in desktop preview URLs.
 * Lets the desktop proxy authorize iframe/WebSocket requests without relying on the
 * rcd_session cookie being sent cross-site — needed when the proxy runs on a different
 * origin than the app (split hosting: app on Vercel, proxy on Railway).
 */
export async function signDesktopToken(sandboxId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: sandboxId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret())
}
