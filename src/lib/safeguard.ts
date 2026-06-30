import 'server-only'
import { prisma } from './prisma'
import { logEvent } from './events'

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Scans a piece of student-authored text (a help/report note, a poll answer) against the
 * class's safeguarding watch-list. On a word-boundary match it raises a safeguarding alert in
 * the activity log — recording only the matched term + source, never the raw sensitive text,
 * so the log stays privacy-conscious while still prompting the teacher to check in.
 * Returns the matched term, or null.
 */
export async function scanText(
  classroomId: string,
  opts: { studentId?: string | null; studentName?: string | null; source: string; text: string },
): Promise<string | null> {
  if (!opts.text?.trim()) return null
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { safeguardKeywords: true },
  })
  const terms = (classroom?.safeguardKeywords || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  if (terms.length === 0) return null

  const hay = opts.text.toLowerCase()
  const hit = terms.find((t) => new RegExp(`(^|\\W)${escapeRegex(t)}(\\W|$)`).test(hay))
  if (!hit) return null

  await logEvent({
    classroomId,
    studentId: opts.studentId ?? null,
    type: 'safeguard',
    actorRole: 'system',
    message: `Safeguarding alert: ${opts.studentName ? `${opts.studentName}'s` : "a student's"} ${opts.source} matched watch-term “${hit}” — check in with the student.`,
  })
  return hit
}
