import { prisma } from '@/lib/prisma'
import { currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

// Prometheus text exposition for platform monitoring. If METRICS_TOKEN is set, require it as a
// bearer token; otherwise (local/dev) it's open.
export async function GET(req: Request) {
  const token = process.env.METRICS_TOKEN
  if (token) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${token}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const month = currentUsageMonth()
  const [teachers, students, classes, machineGroups, usage, heartbeat] = await Promise.all([
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.classroom.count(),
    prisma.machine.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.student.aggregate({ where: { usageMonth: month }, _sum: { usageMinutes: true } }),
    prisma.sweeperRun.findUnique({ where: { id: 'singleton' } }),
  ])

  // Optional models — tolerate absence.
  const webhookGroups = await prisma.webhookDelivery
    .groupBy({ by: ['status'], _count: { _all: true } })
    .catch(() => [] as { status: string; _count: { _all: number } }[])
  const gradeGroups = await prisma.ltiGradeJob
    .groupBy({ by: ['status'], _count: { _all: true } })
    .catch(() => [] as { status: string; _count: { _all: number } }[])

  const lines: string[] = []
  const metric = (name: string, help: string, type: string, samples: { labels?: string; value: number }[]) => {
    lines.push(`# HELP ${name} ${help}`)
    lines.push(`# TYPE ${name} ${type}`)
    for (const s of samples) lines.push(`${name}${s.labels ? `{${s.labels}}` : ''} ${s.value}`)
  }

  metric('rcd_teachers_total', 'Total teacher accounts.', 'gauge', [{ value: teachers }])
  metric('rcd_students_total', 'Total student records.', 'gauge', [{ value: students }])
  metric('rcd_classes_total', 'Total classes.', 'gauge', [{ value: classes }])
  metric(
    'rcd_machines',
    'Desktops by lifecycle status.',
    'gauge',
    machineGroups.map((g) => ({ labels: `status="${g.status}"`, value: g._count._all })),
  )
  if (webhookGroups.length)
    metric('rcd_webhook_deliveries', 'Webhook deliveries by status.', 'gauge', webhookGroups.map((g) => ({ labels: `status="${g.status}"`, value: g._count._all })))
  if (gradeGroups.length)
    metric('rcd_lti_grade_jobs', 'LTI AGS grade-passback jobs by status.', 'gauge', gradeGroups.map((g) => ({ labels: `status="${g.status}"`, value: g._count._all })))

  const ageSec = heartbeat?.lastFinishedAt ? Math.round((Date.now() - heartbeat.lastFinishedAt.getTime()) / 1000) : -1
  metric('rcd_sweeper_last_tick_age_seconds', 'Seconds since the sweeper last finished (-1 = never).', 'gauge', [{ value: ageSec }])
  metric('rcd_sweeper_ticks_total', 'Total sweeper ticks since boot.', 'counter', [{ value: heartbeat?.ticks ?? 0 }])
  metric('rcd_month_cost_usd', 'Estimated desktop spend this month (USD).', 'gauge', [{ value: estimateCostCents(usage._sum.usageMinutes ?? 0) / 100 }])

  return new Response(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' } })
}
