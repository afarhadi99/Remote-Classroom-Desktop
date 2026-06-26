// Captures README screenshots against the running dev server (http://localhost:3000).
// Run with:  node --env-file=.env scripts/screenshots.mjs
// Boots one real Daytona desktop for the live shots, then shuts it down.

import { chromium } from "playwright"
import { PrismaClient } from "@prisma/client"
import { mkdir } from "node:fs/promises"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const OUT = "docs/screenshots"
const TEACHER = { name: "Ms. Rivera", email: "rivera@school.edu", password: "classroom123" }
const STUDENT = "Ada Lovelace"
const CLASS_NAME = "Period 3 — Intro to Linux"

const prisma = new PrismaClient()

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log("  saved", name)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const vp = { width: 1280, height: 860 }

  // ---- 1. Landing (logged out) ----
  const anon = await browser.newContext({ viewport: vp })
  const lp = await anon.newPage()
  await lp.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await lp.waitForTimeout(500)
  await shot(lp, "01-landing")
  await lp.goto(`${BASE}/join`, { waitUntil: "networkidle" })
  await shot(lp, "03-join")
  await anon.close()

  // ---- 2. Teacher ----
  const teacherCtx = await browser.newContext({ viewport: vp })
  let res = await teacherCtx.request.post(`${BASE}/api/auth/teacher/login`, { data: TEACHER })
  if (!res.ok()) await teacherCtx.request.post(`${BASE}/api/auth/teacher/signup`, { data: TEACHER })

  // clean slate: delete existing classes so we can show the create modal + a fresh class
  const existing = (await (await teacherCtx.request.get(`${BASE}/api/classes`)).json()).classes
  for (const c of existing) await teacherCtx.request.delete(`${BASE}/api/classes/${c.id}`)

  const tp = await teacherCtx.newPage()

  // create-class modal (empty dashboard -> New class)
  await tp.goto(`${BASE}/teacher`, { waitUntil: "networkidle" })
  await tp.waitForTimeout(700)
  await tp.getByRole("button", { name: /New class/ }).first().click()
  await tp.waitForTimeout(500)
  await shot(tp, "05-create-class")
  await tp.keyboard.press("Escape").catch(() => {})

  // now create the class for real
  await teacherCtx.request.post(`${BASE}/api/classes`, {
    data: { name: CLASS_NAME, defaultOs: "linux", defaultDurationMin: 45, allowStudentBoot: true },
  })
  const klass = (await (await teacherCtx.request.get(`${BASE}/api/classes`)).json()).classes[0]
  console.log("  class", klass.name, klass.joinCode)

  await tp.goto(`${BASE}/teacher`, { waitUntil: "networkidle" })
  await tp.waitForTimeout(700)
  await shot(tp, "04-teacher-dashboard")

  await tp.goto(`${BASE}/pricing`, { waitUntil: "networkidle" })
  await tp.waitForTimeout(500)
  await shot(tp, "06-pricing")

  await tp.goto(`${BASE}/teacher/billing`, { waitUntil: "networkidle" })
  await tp.waitForTimeout(700)
  await shot(tp, "11-billing")

  // ---- 3. Student joins + boots ----
  const studentCtx = await browser.newContext({ viewport: vp })
  await studentCtx.request.post(`${BASE}/api/auth/student/join`, {
    data: { code: klass.joinCode, name: STUDENT },
  })
  // make sure the student starts clean
  await prisma.machine.deleteMany({})
  await prisma.student.updateMany({ data: { usageMinutes: 0 } })

  const sp = await studentCtx.newPage()
  await sp.goto(`${BASE}/student`, { waitUntil: "networkidle" })
  await sp.waitForTimeout(900)
  await shot(sp, "08-student-ready")

  console.log("  booting desktop...")
  await sp.getByRole("button", { name: /Boot my desktop|Boot a new desktop/ }).first().click()
  await sp.waitForSelector("iframe", { timeout: 90_000 })
  await sp.waitForTimeout(12_000)
  await shot(sp, "09-live-desktop")

  // class manager (with the running machine)
  await tp.goto(`${BASE}/teacher/class/${klass.id}`, { waitUntil: "networkidle" })
  await tp.waitForTimeout(1500)
  await shot(tp, "07-class-manager")

  // time-warning toast
  console.log("  triggering time warning...")
  await prisma.machine.updateMany({
    where: { status: "RUNNING" },
    data: { expiresAt: new Date(Date.now() + 36_000) },
  })
  await sp.waitForTimeout(10_000)
  await shot(sp, "10-time-warning")

  // cleanup
  console.log("  cleaning up desktops...")
  const running = await prisma.machine.findMany({ where: { status: "RUNNING" } })
  for (const m of running) await studentCtx.request.post(`${BASE}/api/machines/${m.id}/stop`).catch(() => {})

  await browser.close()
  await prisma.$disconnect()
  console.log("done.")
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
