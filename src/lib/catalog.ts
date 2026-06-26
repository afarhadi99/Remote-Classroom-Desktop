// Client-safe app catalog: curated starting environments ("golden images") a teacher
// can pin to a class. Each desktop in that class then boots from the chosen snapshot.
//
// The base Linux desktop ships with the product and always works. Other entries point at
// Daytona snapshots an organization builds and publishes (a real golden-image workflow);
// they only boot if that snapshot exists on the org, exactly like the gated Windows class.
import type { OsType } from './os'

export interface CatalogImage {
  id: string
  name: string
  description: string
  emoji: string
  os: OsType
  /** Daytona snapshot id, or null to use the OS default desktop image. */
  snapshot: string | null
  /** True when the snapshot must be pre-built/published on the teacher's Daytona org. */
  requiresOrgImage: boolean
}

export const CATALOG: CatalogImage[] = [
  {
    id: 'linux-desktop',
    name: 'Linux Desktop',
    description: 'Ubuntu + XFCE with Firefox, terminal, code editor and office apps. Ready out of the box.',
    emoji: '🐧',
    os: 'linux',
    snapshot: null,
    requiresOrgImage: false,
  },
  {
    id: 'python-lab',
    name: 'Python Lab',
    description: 'Linux desktop pre-loaded with Python, Jupyter and data-science libraries.',
    emoji: '🐍',
    os: 'linux',
    snapshot: 'rcd/python-lab:latest',
    requiresOrgImage: true,
  },
  {
    id: 'web-dev',
    name: 'Web Dev',
    description: 'Linux desktop with Node, VS Code and the browser dev tools for web classes.',
    emoji: '🌐',
    os: 'linux',
    snapshot: 'rcd/web-dev:latest',
    requiresOrgImage: true,
  },
  {
    id: 'windows-desktop',
    name: 'Windows Desktop',
    description: 'Full Windows environment. Requires the Windows class enabled on your Daytona org.',
    emoji: '🪟',
    os: 'windows',
    snapshot: null,
    requiresOrgImage: true,
  },
]

export const CATALOG_BY_ID: Record<string, CatalogImage> = Object.fromEntries(
  CATALOG.map((c) => [c.id, c]),
)

/** Finds the catalog entry matching a class's (os, snapshot) pairing, if any. */
export function matchCatalog(os: string, snapshot: string | null): CatalogImage | null {
  return (
    CATALOG.find((c) => c.os === os && (c.snapshot ?? null) === (snapshot ?? null)) ?? null
  )
}
