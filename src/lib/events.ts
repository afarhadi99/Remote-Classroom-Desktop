import 'server-only'
import { prisma } from './prisma'

export type EventType =
  | 'boot'
  | 'running'
  | 'stopped'
  | 'expired'
  | 'error'
  | 'lock'
  | 'unlock'
  | 'download'
  | 'provision_all'
  | 'shutdown_all'
  | 'handout'

export interface LogEventInput {
  classroomId: string
  studentId?: string | null
  type: EventType
  message: string
  actorRole?: 'teacher' | 'student' | 'system'
}

/** Append an entry to a class's activity log. Best-effort (never throws). */
export async function logEvent(e: LogEventInput): Promise<void> {
  try {
    await prisma.classEvent.create({
      data: {
        classroomId: e.classroomId,
        studentId: e.studentId ?? null,
        type: e.type,
        message: e.message,
        actorRole: e.actorRole ?? 'system',
      },
    })
  } catch {
    /* logging must never break the request */
  }
}
