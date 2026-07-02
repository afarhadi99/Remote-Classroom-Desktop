import { prisma } from '@/lib/prisma'
import { apiError, getStudent, json } from '@/lib/api'
import { serializeMachine, monthlyUsage } from '@/lib/machines'
import { getPlan } from '@/lib/plans'
import { viewOnlyUrlFromPreview } from '@/lib/daytona'

// Current student's class + their (single) active-or-latest machine + remaining time.
export async function GET() {
  const student = await getStudent()
  if (!student) return apiError('Unauthorized', 401)

  const studentRow = await prisma.student.findUnique({
    where: { id: student.id },
    include: { classroom: { include: { teacher: true } } },
  })
  if (!studentRow) return apiError('Your class no longer exists.', 404)

  // Grouped students share their group's desktop; solo students get their own.
  const machine = studentRow.groupId
    ? await prisma.machine.findFirst({
        where: { groupId: studentRow.groupId },
        orderBy: { createdAt: 'desc' },
        include: { student: true, group: true },
      })
    : await prisma.machine.findFirst({
        where: { studentId: student.id, groupId: null },
        orderBy: { createdAt: 'desc' },
        include: { student: true, group: true },
      })

  const group = studentRow.groupId
    ? await prisma.classGroup.findUnique({ where: { id: studentRow.groupId } })
    : null

  // Live poll / exit ticket pushed to the class (if any is open).
  const openPoll = await prisma.poll.findFirst({
    where: { classroomId: studentRow.classroomId, closedAt: null },
    orderBy: { openedAt: 'desc' },
  })
  let activePoll = null
  if (openPoll) {
    const mine = await prisma.pollResponse.findUnique({
      where: { pollId_studentId: { pollId: openPoll.id, studentId: student.id } },
    })
    activePoll = {
      id: openPoll.id,
      prompt: openPoll.prompt,
      type: openPoll.type,
      options: (openPoll.options as string[] | null) ?? [],
      responded: !!mine,
      myChoice: mine?.choice ?? null,
    }
  }

  const classroom = studentRow.classroom
  const plan = getPlan(classroom.teacher.plan)
  const usage = monthlyUsage(studentRow, plan)

  // Broadcast / spotlight: if the teacher is spotlighting a (running) desktop, surface a
  // view-only stream of it. We skip it when the spotlighted machine is the student's own.
  let spotlight: { tileUrl: string; presenterName: string | null } | null = null
  if (classroom.spotlightMachineId && classroom.spotlightMachineId !== machine?.id) {
    const presenter = await prisma.machine.findUnique({
      where: { id: classroom.spotlightMachineId },
      include: { student: true },
    })
    if (presenter && presenter.status === 'RUNNING' && presenter.previewUrl) {
      const tileUrl = viewOnlyUrlFromPreview(presenter.previewUrl) ?? presenter.previewUrl
      spotlight = { tileUrl, presenterName: presenter.student?.name ?? null }
    }
  }

  return json({
    student: {
      id: student.id,
      name: student.name,
      hasFiles: !!studentRow.volumeId,
      connectionSaver: studentRow.connectionSaver,
    },
    classroom: {
      id: classroom.id,
      name: classroom.name,
      defaultOs: classroom.defaultOs,
      defaultDurationMin: classroom.defaultDurationMin,
      allowStudentBoot: classroom.allowStudentBoot,
      locked: !!classroom.lockedAt,
      lockMessage: classroom.lockMessage,
      examMode: classroom.examMode,
      examMessage: classroom.examMessage,
      announcement: classroom.announcement,
      announcementAt: classroom.announcementAt ? classroom.announcementAt.toISOString() : null,
    },
    // No pricing is ever exposed to students — just their remaining time.
    usage: {
      remaining: usage.remaining,
      unlimited: usage.unlimited,
      sessionCap: Math.min(classroom.defaultDurationMin, plan.maxSessionMinutes),
    },
    machine: machine ? serializeMachine(machine) : null,
    beingWatched:
      machine?.status === 'RUNNING' &&
      !!machine.watchedUntil &&
      machine.watchedUntil.getTime() > Date.now(),
    spotlight,
    flag: studentRow.flaggedAt ? { kind: studentRow.flagKind, at: studentRow.flaggedAt.toISOString() } : null,
    group: group ? { id: group.id, name: group.name } : null,
    activePoll,
    nudge: studentRow.nudge ? { text: studentRow.nudge, at: studentRow.nudgeAt!.toISOString() } : null,
    timeRequested: !!studentRow.timeRequestAt,
    personalLock: studentRow.lockedAt ? { message: studentRow.lockMessage } : null,
    agenda: Array.isArray(classroom.agenda) && classroom.agenda.length
      ? { items: classroom.agenda as string[], step: classroom.agendaStep }
      : null,
    timer: classroom.timerEndsAt && classroom.timerEndsAt.getTime() > Date.now()
      ? { endsAt: classroom.timerEndsAt.toISOString(), label: classroom.timerLabel }
      : null,
  })
}
