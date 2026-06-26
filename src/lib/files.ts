import 'server-only'
import path from 'node:path'
import type { Sandbox } from '@daytonaio/sdk'
import type { Machine, Classroom, Student } from '@prisma/client'

type SandboxFs = Sandbox['fs']
import { prisma } from './prisma'
import { getSession } from './auth'
import { getDaytona, VOLUME_MOUNT_PATH } from './daytona'

export interface FilesError {
  status: number
  message: string
}

type MachineWithRelations = Machine & { classroom: Classroom; student: Student | null }

/**
 * Loads a machine and authorizes the current session to access its files.
 * Teachers may access any machine in a class they own; students only their own machine.
 */
export async function resolveMachineForSession(
  machineId: string,
): Promise<{ machine: MachineWithRelations } | { error: FilesError }> {
  const session = await getSession()
  if (!session) return { error: { status: 401, message: 'Unauthorized' } }

  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { classroom: true, student: true },
  })
  if (!machine) return { error: { status: 404, message: 'Machine not found.' } }

  const authorized =
    (session.role === 'teacher' && machine.classroom.teacherId === session.id) ||
    (session.role === 'student' && machine.studentId === session.id)
  if (!authorized) return { error: { status: 403, message: 'Forbidden' } }

  return { machine }
}

/**
 * Resolves a user-supplied path to an absolute path strictly inside the volume mount.
 * Throws if the path would escape the mount (path traversal).
 */
export function safeJoin(userPath?: string | null): string {
  const root = path.posix.normalize(VOLUME_MOUNT_PATH)
  if (!userPath) return root
  if (userPath.includes('\0')) throw new Error('Invalid path.')
  // defense-in-depth: reject explicit parent segments before normalization
  if (userPath.split('/').includes('..')) throw new Error('Path is outside your files.')

  const candidate = userPath.startsWith('/') ? userPath : path.posix.join(root, userPath)
  const resolved = path.posix.normalize(candidate)
  if (resolved !== root && !resolved.startsWith(root + '/')) {
    throw new Error('Path is outside your files.')
  }
  return resolved
}

/** Returns the running sandbox's filesystem, or an error if the desktop isn't on. */
export async function getRunningSandboxFs(
  machine: MachineWithRelations,
): Promise<{ fs: SandboxFs } | { error: FilesError }> {
  if (machine.status !== 'RUNNING' || !machine.sandboxId) {
    return {
      error: {
        status: 409,
        message: 'The desktop is not running. Files are available while the desktop is on.',
      },
    }
  }
  const sandbox = await getDaytona().get(machine.sandboxId)
  return { fs: sandbox.fs }
}
