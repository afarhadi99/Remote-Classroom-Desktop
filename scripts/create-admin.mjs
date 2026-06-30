// Create or reset a platform super-admin account.
//   node scripts/create-admin.mjs <email> <password> [name]
// or set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in the environment.
import { readFileSync } from 'node:fs'

// Load .env so DATABASE_URL is available.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  /* .env optional */
}

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.argv[3] || process.env.ADMIN_PASSWORD || ''
const name = process.argv[4] || process.env.ADMIN_NAME || 'Platform Admin'

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [name]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

const bcrypt = (await import('bcryptjs')).default
const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()
try {
  const hash = await bcrypt.hash(password, 10)
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { password: hash, name },
    create: { email, name, password: hash },
  })
  console.log(`✅ Admin ready: ${admin.email} (${admin.name})`)
} catch (e) {
  console.error('Failed to create admin:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
