import { prisma } from '@/lib/prisma'
import { apiError, json } from '@/lib/api'
import { getApiCaller } from '@/lib/apikeys'
import { stopMachine } from '@/lib/machines'

// POST /api/v1/machines/{machineId}/stop — shut down a running desktop.
export async function POST(req: Request, { params }: { params: Promise<{ machineId: string }> }) {
  const caller = await getApiCaller(req, 'desktops:write')
  if (!caller.ok) return apiError(caller.error, caller.status)
  const { machineId } = await params

  const machine = await prisma.machine.findUnique({ where: { id: machineId }, include: { classroom: true } })
  if (!machine || machine.classroom.teacherId !== caller.teacherId) return apiError('Machine not found.', 404)

  await stopMachine(machineId)
  return json({ ok: true, machineId })
}
