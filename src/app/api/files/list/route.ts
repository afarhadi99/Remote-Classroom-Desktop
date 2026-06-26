import { apiError, json } from '@/lib/api'
import { resolveMachineForSession, safeJoin, getRunningSandboxFs } from '@/lib/files'
import { daytonaErrorMessage, VOLUME_MOUNT_PATH } from '@/lib/daytona'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const machineId = url.searchParams.get('machineId')
  const pathParam = url.searchParams.get('path')
  if (!machineId) return apiError('Missing machineId.', 400)

  const resolved = await resolveMachineForSession(machineId)
  if ('error' in resolved) return apiError(resolved.error.message, resolved.error.status)

  let fullPath: string
  try {
    fullPath = safeJoin(pathParam)
  } catch (e) {
    return apiError((e as Error).message, 400)
  }

  const fsRes = await getRunningSandboxFs(resolved.machine)
  if ('error' in fsRes) return apiError(fsRes.error.message, fsRes.error.status)

  try {
    const entries = await fsRes.fs.listFiles(fullPath)
    const files = entries
      .map((f) => ({
        name: f.name,
        isDir: f.isDir,
        size: f.size ?? 0,
        modified: f.modifiedAt ?? f.modTime ?? null,
      }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))

    return json({ path: fullPath, atRoot: fullPath === VOLUME_MOUNT_PATH, files })
  } catch (e) {
    return apiError(daytonaErrorMessage(e), 502)
  }
}
