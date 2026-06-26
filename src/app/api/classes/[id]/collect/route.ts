import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { getDaytona, VOLUME_MOUNT_PATH } from '@/lib/daytona'

export const dynamic = 'force-dynamic'

// Collect a submission folder from every running desktop: returns each student's files
// in My-Files/<folder> so the teacher can review and download them.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id } = await params

  const classroom = await prisma.classroom.findFirst({ where: { id, teacherId: teacher.id } })
  if (!classroom) return apiError('Class not found.', 404)

  // a single safe folder segment under My-Files
  const raw = new URL(req.url).searchParams.get('folder') || 'Turn-in'
  const folder = raw.replace(/[\x00-\x1f]/g, '').split(/[\\/]/).filter(Boolean).pop() || 'Turn-in'
  const folderPath = `${VOLUME_MOUNT_PATH}/${folder}`

  const running = await prisma.machine.findMany({
    where: { classroomId: id, status: 'RUNNING', sandboxId: { not: null } },
    include: { student: true },
    orderBy: { createdAt: 'desc' },
  })

  const daytona = getDaytona()
  const students = await Promise.all(
    running.map(async (m) => {
      let files: { name: string; size: number; path: string }[] = []
      try {
        const sb = await daytona.get(m.sandboxId!)
        const entries = await sb.fs.listFiles(folderPath)
        files = entries
          .filter((f) => !f.isDir)
          .map((f) => ({ name: f.name, size: f.size ?? 0, path: `${folderPath}/${f.name}` }))
      } catch {
        /* folder may not exist for this student yet */
      }
      return { machineId: m.id, studentName: m.student?.name ?? 'Student', files }
    }),
  )

  return json({ folder, students })
}
