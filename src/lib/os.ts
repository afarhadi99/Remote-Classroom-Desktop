// Client-safe OS metadata (no SDK imports here so it can be used in client components).

export type OsType = 'linux' | 'windows'

export interface OsMeta {
  id: OsType
  label: string
  short: string
  description: string
  /** Whether this OS is currently selectable in the UI. */
  available: boolean
  accent: string // tailwind gradient classes
}

export const OS_LIST: OsMeta[] = [
  {
    id: 'linux',
    label: 'Linux Desktop',
    short: 'Linux',
    description: 'Full Ubuntu + XFCE desktop with Firefox, files, terminal and apps. Boots in seconds.',
    available: true,
    accent: 'from-orange-500 to-amber-600',
  },
  {
    id: 'windows',
    label: 'Windows Desktop',
    short: 'Windows',
    description: 'Windows desktop environment. Requires the Windows class to be enabled on your Daytona organization.',
    available: true,
    accent: 'from-sky-500 to-blue-600',
  },
]

export const OS_BY_ID: Record<OsType, OsMeta> = Object.fromEntries(
  OS_LIST.map((o) => [o.id, o]),
) as Record<OsType, OsMeta>

export function isOsType(v: unknown): v is OsType {
  return v === 'linux' || v === 'windows'
}

// Where each student's persistent volume is mounted (client-safe copy of the
// server constant in daytona.ts). Used by the file browser UI.
export const MY_FILES_PATH = '/home/daytona/Desktop/My-Files'
