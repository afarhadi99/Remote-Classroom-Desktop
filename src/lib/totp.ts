import 'server-only'
// RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — the same algorithm Google Authenticator,
// Authy, and 1Password use. No external dependency: HMAC comes from node:crypto, and the
// secret is base32 (RFC 4648) since that's what every authenticator app expects you to
// type in or scan.
import { createHmac, randomBytes } from 'node:crypto'

const STEP_SECONDS = 30
const DIGITS = 6
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Generates a new random base32 secret suitable for an authenticator app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', secret).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** The current 6-digit code for a base32 secret, at the given time. */
export function totpCode(secretBase32: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  return hotp(base32Decode(secretBase32), counter)
}

/** Verifies a code, tolerating ±1 step (30s) of clock drift between server and phone. */
export function verifyTotpCode(secretBase32: string, code: string, at: number = Date.now()): boolean {
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) return false
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  const secret = base32Decode(secretBase32)
  for (const drift of [0, -1, 1]) {
    if (hotp(secret, counter + drift) === trimmed) return true
  }
  return false
}

/** otpauth:// URI for manual entry into an authenticator app (no QR image needed). */
export function totpAuthUrl(secretBase32: string, accountLabel: string, issuer = 'Remote Classroom'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`)
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`
}

/** Generates N human-typeable single-use backup codes (e.g. "7F3K-9QRT"). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex').toUpperCase().slice(0, 8)
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`)
  }
  return codes
}
