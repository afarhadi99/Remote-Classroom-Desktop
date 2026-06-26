import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { stopMachine } from '@/lib/machines'

const ACTIVE = ['RUNNING', 'PROVISIONING']

async function ownedGroup(teacherId: string, classId: string, groupId: string) {
  const cls = await prisma.classroom.findFirst({ where: { id: classId, teacherId } })
  if (!cls) return null
  return prisma.classGroup.findFirst({ where: { id: groupId, classroomId: classId } })
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  // Full member list — students set here join the group; current members not listed leave it.
  studentIds: z.array(z.string()).max(200).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, groupId } = await params
  const group = await ownedGroup(teacher.id, id, groupId)
  if (!group) return apiError('Group not found.', 404)

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid group update.')

  if (parsed.data.name) {
    await prisma.classGroup.update({ where: { id: groupId }, data: { name: parsed.data.name } })
  }

  if (parsed.data.studentIds) {
    const ids = parsed.data.studentIds
    // Drop members who are no longer in the list.
    await prisma.student.updateMany({
      where: { classroomId: id, groupId, id: { notIn: ids } },
      data: { groupId: null },
    })
    // Add/keep the listed members (also pulls them out of any other group).
    if (ids.length) {
      await prisma.student.updateMany({
        where: { classroomId: id, id: { in: ids } },
        data: { groupId },
      })
    }
  }

  return json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)
  const { id, groupId } = await params
  const group = await ownedGroup(teacher.id, id, groupId)
  if (!group) return apiError('Group not found.', 404)

  // Tear down the group's running desktop first, then delete (members are auto-unassigned).
  const active = await prisma.machine.findMany({ where: { groupId, status: { in: ACTIVE } } })
  await Promise.all(active.map((m) => stopMachine(m.id)))
  await prisma.classGroup.delete({ where: { id: groupId } })
  return json({ ok: true })
}
