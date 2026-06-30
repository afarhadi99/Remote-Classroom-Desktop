import { prisma } from '@/lib/prisma'
import { apiError, getAdmin, json } from '@/lib/api'
import { stopMachine } from '@/lib/machines'

// Admin force-stop of any desktop on the platform.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const { id } = await params

  const machine = await prisma.machine.findUnique({ where: { id } })
  if (!machine) return apiError('Desktop not found.', 404)
  await stopMachine(id)
  return json({ ok: true })
}
