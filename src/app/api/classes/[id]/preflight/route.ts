import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getPlan, isUnlimited, currentUsageMonth } from '@/lib/plans'
import { estimateCostCents, formatUsd } from '@/lib/cost'

export const dynamic = 'force-dynamic'

const ACTIVE = ['RUNNING', 'PROVISIONING']
type Level = 'ok' | 'warn' | 'fail'

// Pre-flight readiness check: surfaces everything that commonly sinks a live class BEFORE the
// bell — no students, a gated OS / unpublished custom image, an empty allowlist, hitting the
// student cap, or a guardrail (concurrency / spend) that's already maxed. Read-only; no boots.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)
  const teacherRecord = await prisma.teacher.findUnique({ where: { id: teacher.id } })
  const plan = getPlan(teacherRecord?.plan)

  const checks: { key: string; level: Level; message: string }[] = []
  const add = (key: string, level: Level, message: string) => checks.push({ key, level, message })

  const studentCount = await prisma.student.count({ where: { classroomId: id, archivedAt: null } })
  if (studentCount === 0) add('roster', 'fail', 'No students have joined yet — share the class code first.')
  else add('roster', 'ok', `${studentCount} student${studentCount === 1 ? '' : 's'} enrolled.`)

  if (!classroom.allowStudentBoot) add('boot', 'warn', 'Self-service boot is off — only you can start desktops.')
  else add('boot', 'ok', 'Students can boot their own desktops.')

  if (classroom.defaultOs === 'windows') add('os', 'warn', 'Windows requires the Windows class enabled on your Daytona org.')
  else add('os', 'ok', 'Linux desktops are ready out of the box.')

  if (classroom.snapshot) add('image', 'warn', `Custom image "${classroom.snapshot}" must be published on your Daytona org.`)

  if (!isUnlimited(plan.maxStudentsPerClass) && studentCount >= plan.maxStudentsPerClass)
    add('cap', 'warn', `At the ${plan.maxStudentsPerClass}-student cap — new students can't join until you upgrade.`)

  if (classroom.netMode === 'allowlist' && !classroom.allowedDomains?.trim())
    add('network', 'warn', 'Internet is allowlist-only but the allowlist is empty — students will have no web access.')
  else if (classroom.netMode === 'blocked') add('network', 'ok', 'Internet is fully blocked for this class.')

  if (teacherRecord?.maxConcurrentDesktops != null) {
    const active = await prisma.machine.count({ where: { classroom: { teacherId: teacher.id }, status: { in: ACTIVE } } })
    if (active >= teacherRecord.maxConcurrentDesktops)
      add('concurrency', 'fail', `Concurrency limit reached (${active}/${teacherRecord.maxConcurrentDesktops}) — boots are frozen.`)
    else if (active + studentCount > teacherRecord.maxConcurrentDesktops)
      add('concurrency', 'warn', `Booting all ${studentCount} could exceed your concurrency limit of ${teacherRecord.maxConcurrentDesktops}.`)
    else add('concurrency', 'ok', `Within your concurrency limit (${active}/${teacherRecord.maxConcurrentDesktops}).`)
  }

  if (teacherRecord?.monthlySpendCapCents != null) {
    const agg = await prisma.student.aggregate({ where: { classroom: { teacherId: teacher.id }, usageMonth: currentUsageMonth() }, _sum: { usageMinutes: true } })
    const spent = estimateCostCents(agg._sum.usageMinutes ?? 0)
    if (spent >= teacherRecord.monthlySpendCapCents)
      add('spend', 'fail', `Monthly spend cap reached (${formatUsd(spent)}/${formatUsd(teacherRecord.monthlySpendCapCents)}).`)
    else add('spend', 'ok', `Within budget (${formatUsd(spent)}/${formatUsd(teacherRecord.monthlySpendCapCents)} this month).`)
  }

  const ready = !checks.some((c) => c.level === 'fail')
  return json({ ready, checks })
}
