import { Readable } from 'node:stream'
import { apiError } from '@/lib/api'
import { resolveMachineForSession, safeJoin, getRunningSandboxFs } from '@/lib/files'
import { daytonaErrorMessage } from '@/lib/daytona'
import { logEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024 // 500 MB policy cap (streamed, not buffered)

// Builds an RFC 5987 Content-Disposition that survives quotes, control chars and unicode.
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const machineId = url.searchParams.get('machineId')
  const pathParam = url.searchParams.get('path')
  if (!machineId || !pathParam) return apiError('Missing machineId or path.', 400)

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
  const fs = fsRes.fs

  try {
    const info = await fs.getFileDetails(fullPath)
    if (info.isDir) return apiError('Cannot download a folder.', 400)
    if (info.size && info.size > MAX_DOWNLOAD_BYTES) {
      return apiError('File is too large to download from the browser.', 413)
    }

    const name = info.name || fullPath.split('/').pop() || 'download'

    const { machine, session } = resolved
    const who = session.role === 'teacher' ? 'Teacher' : machine.student?.name ?? 'Student'
    await logEvent({
      classroomId: machine.classroomId,
      studentId: machine.studentId,
      type: 'download',
      actorRole: session.role === 'student' ? 'student' : 'teacher',
      message: `${who} downloaded "${name}"${session.role === 'teacher' ? ` from ${machine.student?.name ?? 'a student'}'s files` : ''}`,
    })

    // Stream rather than buffer: avoids loading the whole file into the shared server's
    // memory (the 200MB cap was previously bypassable when stat reported a falsy size).
    const stream = await fs.downloadFileStream(fullPath)
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>

    return new Response(body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition(name),
        ...(info.size ? { 'Content-Length': String(info.size) } : {}),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return apiError(daytonaErrorMessage(e), 502)
  }
}
