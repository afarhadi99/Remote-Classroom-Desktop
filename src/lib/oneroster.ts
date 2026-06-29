import 'server-only'
import { prisma } from './prisma'
import { generateJoinCode } from './utils'
import { getPlan, isUnlimited } from './plans'
import { stopMachine } from './machines'

// ---- Minimal RFC-4180 CSV parser -----------------------------------------
// Handles quoted fields, embedded commas/newlines, and "" escaping. Returns objects keyed
// by the header row. Good enough for OneRoster bundle files.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row) }
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    header.forEach((h, idx) => (o[h] = (r[idx] ?? '').trim()))
    return o
  })
}

export interface OneRosterInput {
  users: string
  classes: string
  enrollments: string
  orgs?: string
}
export interface SyncResult {
  ok: boolean
  error?: string
  dryRun: boolean
  adds: { classes: number; students: number }
  updates: { classes: number; students: number }
  removes: { students: number }
  skippedOverCap: number
  details: string[]
}

const isDeleted = (status: string | undefined) => (status ?? '').toLowerCase() === 'tobedeleted'

/**
 * Idempotently syncs a OneRoster CSV bundle into the importing teacher's classes. Classes are
 * keyed by sourcedId; student membership by (class, user) sourcedId. Students present before but
 * absent now (or status=tobedeleted) are soft-archived and their running desktops stopped.
 * dryRun returns the diff without writing.
 */
export async function syncOneRoster(
  teacherId: string,
  input: OneRosterInput,
  dryRun: boolean,
): Promise<SyncResult> {
  const result: SyncResult = {
    ok: true,
    dryRun,
    adds: { classes: 0, students: 0 },
    updates: { classes: 0, students: 0 },
    removes: { students: 0 },
    skippedOverCap: 0,
    details: [],
  }

  let userRows: Record<string, string>[]
  let classRows: Record<string, string>[]
  let enrollRows: Record<string, string>[]
  try {
    userRows = parseCsv(input.users)
    classRows = parseCsv(input.classes)
    enrollRows = parseCsv(input.enrollments)
  } catch {
    return { ...result, ok: false, error: 'Could not parse CSV bundle.' }
  }

  // Validate required columns.
  if (!userRows.length || !('sourcedId' in userRows[0])) return { ...result, ok: false, error: 'users.csv: missing sourcedId column or rows.' }
  if (!classRows.length || !('sourcedId' in classRows[0])) return { ...result, ok: false, error: 'classes.csv: missing sourcedId column or rows.' }
  if (!enrollRows.length || !('classSourcedId' in enrollRows[0]) || !('userSourcedId' in enrollRows[0]))
    return { ...result, ok: false, error: 'enrollments.csv: missing classSourcedId/userSourcedId columns or rows.' }

  // Index users (students only) by sourcedId.
  const studentUsers = new Map<string, { name: string; deleted: boolean }>()
  for (const u of userRows) {
    const role = (u.role || '').toLowerCase()
    if (role !== 'student') continue
    if (!u.sourcedId) return { ...result, ok: false, error: 'users.csv: a row is missing sourcedId.' }
    const name = `${u.givenName || ''} ${u.familyName || ''}`.trim() || u.email || u.username || u.sourcedId
    studentUsers.set(u.sourcedId, { name: name.slice(0, 80), deleted: isDeleted(u.status) })
  }

  // Index classes.
  const classTitles = new Map<string, { title: string; deleted: boolean }>()
  for (const c of classRows) {
    if (!c.sourcedId) return { ...result, ok: false, error: 'classes.csv: a row is missing sourcedId.' }
    classTitles.set(c.sourcedId, { title: (c.title || c.classCode || c.sourcedId).slice(0, 80), deleted: isDeleted(c.status) })
  }

  // Desired membership: class sourcedId -> set of student user sourcedIds (active student enrollments).
  const desired = new Map<string, Map<string, string>>() // classSid -> (userSid -> name)
  for (const e of enrollRows) {
    if ((e.role || '').toLowerCase() !== 'student') continue
    if (isDeleted(e.status)) continue
    const cls = classTitles.get(e.classSourcedId)
    const stu = studentUsers.get(e.userSourcedId)
    if (!cls || cls.deleted || !stu || stu.deleted) continue
    if (!desired.has(e.classSourcedId)) desired.set(e.classSourcedId, new Map())
    desired.get(e.classSourcedId)!.set(e.userSourcedId, stu.name)
  }

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
  if (!teacher) return { ...result, ok: false, error: 'Teacher not found.' }
  const plan = getPlan(teacher.plan)

  // Current synced classes for this teacher.
  const existingClasses = await prisma.classroom.findMany({
    where: { teacherId, sourcedId: { not: null } },
    include: { students: { where: { sourcedId: { not: null } } } },
  })
  const existingBySid = new Map(existingClasses.map((c) => [c.sourcedId!, c]))
  let classCount = await prisma.classroom.count({ where: { teacherId } })

  // Plan: how many NEW classes can we create?
  const desiredClassSids = [...desired.keys()]
  for (const classSid of desiredClassSids) {
    const cls = classTitles.get(classSid)!
    const members = desired.get(classSid)! // userSid -> name
    let classroom = existingBySid.get(classSid)

    // ---- class add / update ----
    if (!classroom) {
      if (!isUnlimited(plan.maxClasses) && classCount >= plan.maxClasses) {
        result.skippedOverCap++
        result.details.push(`skip class "${cls.title}" (over ${plan.name} class cap)`)
        continue
      }
      result.adds.classes++
      classCount++
      if (!dryRun) {
        let joinCode = generateJoinCode()
        for (let i = 0; i < 5; i++) {
          if (!(await prisma.classroom.findUnique({ where: { joinCode } }))) break
          joinCode = generateJoinCode()
        }
        classroom = (await prisma.classroom.create({
          data: { teacherId, name: cls.title, joinCode, sourcedId: classSid },
          include: { students: true },
        })) as (typeof existingClasses)[number]
      }
    } else if (classroom.name !== cls.title) {
      result.updates.classes++
      if (!dryRun) await prisma.classroom.update({ where: { id: classroom.id }, data: { name: cls.title } })
    }

    // ---- student add / update / archive within this class ----
    const current = classroom ? classroom.students : []
    const currentBySid = new Map(current.map((s) => [s.sourcedId!, s]))

    // capacity for new students in this class
    const activeCount = current.filter((s) => !s.archivedAt).length
    let room = isUnlimited(plan.maxStudentsPerClass) ? Infinity : Math.max(0, plan.maxStudentsPerClass - activeCount)

    for (const [userSid, name] of members) {
      const existing = currentBySid.get(userSid)
      if (!existing) {
        if (room <= 0) { result.skippedOverCap++; continue }
        room--
        result.adds.students++
        if (!dryRun && classroom) {
          await prisma.student.create({ data: { classroomId: classroom.id, name, sourcedId: userSid } }).catch(() => {})
        }
      } else if (existing.name !== name || existing.archivedAt) {
        result.updates.students++
        if (!dryRun) await prisma.student.update({ where: { id: existing.id }, data: { name, archivedAt: null } })
      }
    }

    // removes: synced students no longer enrolled
    for (const s of current) {
      if (s.archivedAt) continue
      if (!members.has(s.sourcedId!)) {
        result.removes.students++
        if (!dryRun) {
          await prisma.student.update({ where: { id: s.id }, data: { archivedAt: new Date() } }).catch(() => {})
          const active = await prisma.machine.findFirst({
            where: { studentId: s.id, status: { in: ['RUNNING', 'PROVISIONING'] } },
          })
          if (active) await stopMachine(active.id)
        }
      }
    }
  }

  return result
}
