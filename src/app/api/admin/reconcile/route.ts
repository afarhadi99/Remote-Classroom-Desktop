import { apiError, getAdmin, json } from '@/lib/api'
import { reconcileDesktops } from '@/lib/machines'

export const dynamic = 'force-dynamic'

// Platform admin: on-demand DB<->Daytona reconcile (delete orphaned sandboxes, stop dead rows).
export async function POST() {
  const admin = await getAdmin()
  if (!admin) return apiError('Unauthorized', 401)
  const result = await reconcileDesktops()
  return json({ ok: true, ...result })
}
