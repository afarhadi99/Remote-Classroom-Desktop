// Captures README screenshots against the running dev server (http://localhost:3000).
// Run with:  node --env-file=.env scripts/screenshots.mjs
// Boots one real Daytona desktop for the live shots, then shuts it down.

import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = 'docs/screenshots'
const TEACHER = { name: 'Ms. Rivera', email: 'rivera@school.edu', password: 'classroom123' }
const STUDENT = 'Ada Lovelace'

const prisma = new PrismaClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('  saved', name)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()

  // ---- 1. Landing (logged out) ----
  const anon = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const lp = await anon.newPage()
  await lp.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await shot(lp, '01-landing')
  await lp.goto(`${BASE}/join`, { waitUntil: 'networkidle' })
  await shot(lp, '03-join')
  await anon.close()

  // ---- 2. Teacher ----
  const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  // login (sign up if needed)
  let res = await teacherCtx.request.post(`${BASE}/api/auth/teacher/login`, { data: TEACHER })
  if (!res.ok()) {
    await teacherCtx.request.post(`${BASE}/api/auth/teacher/signup`, { data: TEACHER })
  }
  // ensure a class exists, grab its join code + id
  let { classes } = await (await teacherCtx.request.get(`${BASE}/api/classes`)).json()
  if (!classes.length) {
    await teacherCtx.request.post(`${BASE}/api/classes`, {
      data: { name: 'Period 3 — Intro to Linux', defaultOs: 'linux', defaultDurationMin: 60, allowStudentBoot: true },
    })
    classes = (await (await teacherCtx.request.get(`${BASE}/api/classes`)).json()).classes
  }
  const klass = classes[0]
  console.log('  class', klass.name, klass.joinCode)

  // clean slate for a pristine "ready to boot" student shot (no Daytona sandboxes are live now)
  await prisma.machine.deleteMany({})

  const tp = await teacherCtx.newPage()
  await tp.goto(`${BASE}/teacher`, { waitUntil: 'networkidle' })
  await tp.waitForTimeout(800)
  await shot(tp, '04-teacher-dashboard')

  // create-class modal
  await tp.getByRole('button', { name: /New class/ }).first().click()
  await tp.waitForTimeout(500)
  await shot(tp, '05-create-class')
  await tp.keyboard.press('Escape').catch(() => {})

  // ---- 3. Student joins + boots ----
  const studentCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await studentCtx.request.post(`${BASE}/api/auth/student/join`, {
    data: { code: klass.joinCode, name: STUDENT },
  })
  const sp = await studentCtx.newPage()
  await sp.goto(`${BASE}/student`, { waitUntil: 'networkidle' })
  await sp.waitForTimeout(800)
  // If a previous machine is showing, shut it down to get a clean "ready" shot
  const shutBtn = sp.getByRole('button', { name: /Shut down/ })
  if (await shutBtn.count()) {
    await shutBtn.first().click()
    await sp.waitForTimeout(4000)
  }
  await sp.goto(`${BASE}/student`, { waitUntil: 'networkidle' })
  await sp.waitForTimeout(1500)
  await shot(sp, '08-student-ready')

  // boot a real desktop
  console.log('  booting desktop...')
  await sp.getByRole('button', { name: /Boot my desktop|Boot a new desktop/ }).first().click()
  // wait for RUNNING (iframe present)
  await sp.waitForSelector('iframe', { timeout: 90_000 })
  // give noVNC time to connect + render the desktop
  await sp.waitForTimeout(12_000)
  await shot(sp, '09-live-desktop')

  // ---- 4. Teacher class manager (now with a running machine) ----
  await tp.goto(`${BASE}/teacher/class/${klass.id}`, { waitUntil: 'networkidle' })
  await tp.waitForTimeout(1500)
  await shot(tp, '07-class-manager')

  // ---- 5. Time-warning toast ----
  console.log('  triggering time warning...')
  await prisma.machine.updateMany({
    where: { status: 'RUNNING' },
    data: { expiresAt: new Date(Date.now() + 36_000) },
  })
  // wait for the page to poll the new expiry and cross the 30s threshold
  await sp.waitForTimeout(10_000)
  await shot(sp, '10-time-warning')

  // ---- cleanup: stop any running desktop ----
  console.log('  cleaning up desktops...')
  const running = await prisma.machine.findMany({ where: { status: 'RUNNING' } })
  for (const m of running) {
    await studentCtx.request.post(`${BASE}/api/machines/${m.id}/stop`).catch(() => {})
  }

  await browser.close()
  await prisma.$disconnect()
  console.log('done.')
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
