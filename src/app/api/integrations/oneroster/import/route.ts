import { z } from 'zod'
import { apiError, getTeacher, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'
import { syncOneRoster } from '@/lib/oneroster'
import { logEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

const schema = z.object({
  dryRun: z.boolean().default(true),
  users: z.string().min(1).max(5_000_000),
  classes: z.string().min(1).max(5_000_000),
  enrollments: z.string().min(1).max(5_000_000),
  orgs: z.string().max(5_000_000).optional(),
})

// POST /api/integrations/oneroster/import — ingest a OneRoster 1.1 CSV bundle.
// Auth: teacher session OR an API key with roster:write. Default is a no-write dry-run.
export async function POST(req: Request) {
  let teacherId: string | null = null
  const session = await getTeacher()
  if (session) teacherId = session.id
  else {
    const caller = await getApiCaller(req, 'roster:write')
    if (!caller.ok) return apiError(caller.error, caller.status)
    teacherId = caller.teacherId
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Provide users, classes and enrollments CSV text.')

  const result = await syncOneRoster(teacherId, parsed.data, parsed.data.dryRun)
  if (!result.ok) return apiError(result.error || 'Sync failed.', 422)

  if (!parsed.data.dryRun) {
    // Log against the first synced class for an audit trail (best-effort).
    const summary = `OneRoster sync: +${result.adds.classes} classes, +${result.adds.students} students, ` +
      `${result.updates.students} updated, ${result.removes.students} archived`
    const anyClass = await (await import('@/lib/prisma')).prisma.classroom.findFirst({
      where: { teacherId, sourcedId: { not: null } },
      select: { id: true },
    })
    if (anyClass) {
      await logEvent({ classroomId: anyClass.id, type: 'provision_all', actorRole: 'system', message: summary })
    }
  }

  return json(result)
}
