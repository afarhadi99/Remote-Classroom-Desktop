import { prisma } from '@/lib/prisma'
import { apiError, getTeacher, json } from '@/lib/api'
import { currentUsageMonth } from '@/lib/plans'
import { estimateCostCents } from '@/lib/cost'

export const dynamic = 'force-dynamic'

// This-month desktop-time usage across all of a teacher's classes, with an estimated cost.
export async function GET() {
  const teacher = await getTeacher()
  if (!teacher) return apiError('Unauthorized', 401)

  const month = currentUsageMonth()
  const classes = await prisma.classroom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
    include: { students: true },
  })

  const perClass = classes.map((c) => {
    const minutes = c.students.reduce(
      (sum, s) => sum + (s.usageMonth === month ? s.usageMinutes : 0),
      0,
    )
    return {
      id: c.id,
      name: c.name,
      studentCount: c.students.length,
      minutes,
      estimatedCostCents: estimateCostCents(minutes),
    }
  })

  const totalMinutes = perClass.reduce((s, c) => s + c.minutes, 0)
  return json({
    month,
    totalMinutes,
    estimatedCostCents: estimateCostCents(totalMinutes),
    classes: perClass,
  })
}
