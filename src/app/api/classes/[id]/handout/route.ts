import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getDaytona, VOLUME_MOUNT_PATH } from '@/lib/daytona'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_HANDOUT_BYTES = 50 * 1024 * 1024 // 50 MB

// Push one uploaded file into the Handouts folder of every running desktop in the class.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return apiError('No file provided.', 400)
  if (file.size > MAX_HANDOUT_BYTES) return apiError('File is too large (50 MB max).', 413)

  const fileName = (file.name || 'handout').split(/[\\/]/).pop()!.replace(/[\x00-\x1f]/g, '_')
  const buffer = Buffer.from(await file.arrayBuffer())

  const running = await prisma.machine.findMany({
    where: { classroomId: id, status: 'RUNNING', sandboxId: { not: null } },
  })
  const totalStudents = await prisma.student.count({ where: { classroomId: id } })

  const daytona = getDaytona()
  let delivered = 0
  await Promise.all(
    running.map(async (m) => {
      try {
        const sb = await daytona.get(m.sandboxId!)
        await sb.fs.createFolder(`${VOLUME_MOUNT_PATH}/Handouts`, '755').catch(() => {})
        await sb.fs.uploadFile(buffer, `${VOLUME_MOUNT_PATH}/Handouts/${fileName}`)
        delivered++
      } catch {
        /* skip students whose desktop dropped mid-handout */
      }
    }),
  )

  await logEvent({
    classroomId: id,
    type: 'handout',
    actorRole: 'teacher',
    message: `Handed out "${fileName}" to ${delivered} desktop${delivered === 1 ? '' : 's'}`,
  })

  return json({
    ok: true,
    fileName,
    delivered,
    notRunning: Math.max(0, totalStudents - running.length),
  })
}
