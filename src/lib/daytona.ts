import 'server-only'
import { Daytona, type Sandbox } from '@daytonaio/sdk'
import { type OsType, MY_FILES_PATH } from './os'
import { signDesktopToken } from './desktop-token'

// Snapshot/image per OS. Linux uses the computer-use desktop snapshot (xfce4 + noVNC).
// Windows uses the gated "windows" class snapshot (must be enabled on the org).
export const OS_SNAPSHOTS: Record<OsType, string> = {
  linux: 'daytonaio/sandbox:0.6.0',
  windows: 'windows',
}

// Port that serves the in-browser desktop client for each OS. Both classes expose
// standard noVNC on 6080 (confirmed against a live "windows" class sandbox — it is
// NOT dockur's port 8006, which never becomes reachable on this snapshot).
const OS_VNC_PORT: Record<OsType, number> = {
  linux: 6080, // noVNC
  windows: 6080, // noVNC
}

// Where each student's persistent volume is mounted. Placing it on the Desktop
// makes a "My-Files" folder appear on the desktop that survives machine restarts.
export const VOLUME_MOUNT_PATH = MY_FILES_PATH

// Path prefix handled by the desktop reverse proxy. Same-origin (relative) in local dev
// (server.mjs); an absolute URL to the standalone proxy service (e.g. on Railway) when
// the app and the proxy are split across different hosts.
const DESKTOP_PROXY_PREFIX = '/desktop/'
const DESKTOP_PROXY_ORIGIN = (process.env.DESKTOP_PROXY_ORIGIN || '').trim().replace(/\/+$/, '')

/**
 * Given an interactive desktop preview URL (.../desktop/<host>/vnc.html?...), builds a
 * VIEW-ONLY, auto-scaled noVNC URL suitable for a monitoring-wall thumbnail. Returns
 * null if the host can't be parsed. Both OS classes serve noVNC, so this works for either.
 * Preserves the origin prefix (if any) and the access token from the source URL.
 */
export function viewOnlyUrlFromPreview(previewUrl: string): string | null {
  const match = previewUrl.match(/^(.*?)\/desktop\/([^/]+)\//)
  if (!match) return null
  const [, origin, host] = match
  const dtok = previewUrl.match(/[?&]dtok=([^&]+)/)?.[1]
  const tokenQ = dtok ? `&dtok=${dtok}` : ''
  const wsPath = `desktop/${host}/websockify${dtok ? `?dtok=${dtok}` : ''}`
  const q =
    'autoconnect=true&reconnect=true&reconnect_delay=2000&view_only=true&resize=scale' +
    '&quality=3&compression=9&show_dot=false&bell=off'
  return `${origin}/desktop/${host}/vnc.html?${q}${tokenQ}&path=${encodeURIComponent(wsPath)}`
}

let client: Daytona | null = null

export function getDaytona(): Daytona {
  if (!client) {
    const apiKey = process.env.DAYTONA_API_KEY
    if (!apiKey) throw new Error('DAYTONA_API_KEY is not set')
    client = new Daytona({ apiKey, target: process.env.DAYTONA_TARGET || 'us' })
  }
  return client
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Gets (or creates) a named volume and waits until it reaches the "ready" state.
 * A freshly created volume starts in "pending_create" and cannot be mounted until ready.
 */
export async function getOrCreateVolume(name: string): Promise<{ id: string; name: string }> {
  const daytona = getDaytona()
  let vol = await daytona.volume.get(name, true)

  const deadline = Date.now() + 90_000
  while (String(vol.state).toLowerCase() !== 'ready' && Date.now() < deadline) {
    if (String(vol.state).toLowerCase() === 'error') {
      throw new Error(`Volume "${name}" failed to provision.`)
    }
    await sleep(2000)
    vol = await daytona.volume.get(name, false)
  }

  if (String(vol.state).toLowerCase() !== 'ready') {
    throw new Error(`Volume "${name}" did not become ready in time (state: ${vol.state}).`)
  }
  return { id: vol.id, name: vol.name }
}

export interface CreateDesktopOptions {
  os: OsType
  /** Golden-image override: a specific Daytona snapshot id (falls back to the OS default). */
  snapshot?: string | null
  /** Auto-stop after this many minutes of inactivity (cost safety net). */
  autoStopInterval: number
  volumeId?: string
  labels?: Record<string, string>
  /** Block all network access (exam / no-internet mode). */
  networkBlockAll?: boolean
  /** Comma-separated allowlist of domains; everything else is blocked. */
  domainAllowList?: string
  /**
   * When the desktop-access token embedded in the preview URL should expire (needed for
   * the proxy to authorize requests when it runs on a different origin than the app, so
   * the rcd_session cookie isn't sent). Should outlive the session's expected duration.
   */
  tokenExpiresAt: Date
}

export interface DesktopHandle {
  sandboxId: string
  previewUrl: string
  previewToken: string | null
}

/**
 * Provisions a cloud desktop sandbox, starts the GUI, and returns a
 * browser-loadable preview URL. Throws DaytonaError on failure (e.g. Windows gated).
 *
 * The desktop is reachable ONLY through our authenticated same-origin proxy (server.mjs),
 * which requires a valid session authorized for this specific machine. The sandbox preview
 * is public at the Daytona edge (private previews require an interactive Daytona/Auth0
 * login that students don't have), but the sandbox host is only ever disclosed in-app to
 * the owning student or their teacher, and our proxy enforces that on every request.
 */
export async function createDesktop(opts: CreateDesktopOptions): Promise<DesktopHandle> {
  const daytona = getDaytona()
  // Use the class's pinned golden image if set, otherwise the OS default desktop snapshot.
  const snapshot = opts.snapshot?.trim() || OS_SNAPSHOTS[opts.os]
  const volumes = opts.volumeId
    ? [{ volumeId: opts.volumeId, mountPath: VOLUME_MOUNT_PATH }]
    : undefined

  const sandbox: Sandbox = await daytona.create(
    {
      snapshot,
      public: true,
      autoStopInterval: opts.autoStopInterval,
      autoDeleteInterval: 0, // delete as soon as it stops -> no lingering compute; volume persists
      volumes,
      labels: { app: 'remote-classroom', os: opts.os, ...(opts.labels ?? {}) },
      ...(opts.networkBlockAll ? { networkBlockAll: true } : {}),
      ...(opts.domainAllowList ? { domainAllowList: opts.domainAllowList } : {}),
    },
    { timeout: 0 },
  )

  const port = OS_VNC_PORT[opts.os]

  if (opts.os === 'linux') {
    // Start Xvfb + xfce4 + x11vnc + novnc.
    try {
      await sandbox.computerUse.start()
    } catch {
      // best-effort; novnc may already be running
    }
  }

  const preview = await sandbox.getPreviewLink(port)
  // Route the desktop through our proxy (/desktop/<host>/...) so it can inject
  // X-Daytona-Skip-Preview-Warning, skip Daytona's interstitial, and enforce authorization.
  const host = new URL(preview.url).hostname
  const base = `${DESKTOP_PROXY_ORIGIN}${DESKTOP_PROXY_PREFIX}${host}`
  const dtok = await signDesktopToken(sandbox.id, opts.tokenExpiresAt)

  // Both OS classes serve standard noVNC on this port.
  const wsPath = `${DESKTOP_PROXY_PREFIX.slice(1)}${host}/websockify?dtok=${dtok}`
  const previewUrl = `${base}/vnc.html?autoconnect=true&resize=remote&reconnect=true&show_dot=true&dtok=${dtok}&path=${encodeURIComponent(wsPath)}`

  return { sandboxId: sandbox.id, previewUrl, previewToken: preview.token ?? null }
}

/** Stops and deletes a sandbox. Safe to call if it's already gone. */
export async function destroyDesktop(sandboxId: string): Promise<void> {
  const daytona = getDaytona()
  try {
    const sandbox = await daytona.get(sandboxId)
    await sandbox.delete()
  } catch {
    // already deleted / not found — fine
  }
}

/** Deletes a persistent volume by name (right-to-erasure). Safe if it's already gone. */
export async function destroyVolume(name: string): Promise<void> {
  if (!name) return
  const daytona = getDaytona()
  try {
    const vol = await daytona.volume.get(name, false)
    if (vol) await daytona.volume.delete(vol)
  } catch {
    // not found / already deleted — fine
  }
}

/** Maps Daytona/SDK errors to a friendly message for teachers/students. */
export function daytonaErrorMessage(err: unknown): string {
  const e = err as { statusCode?: number; message?: string }
  const msg = e?.message || String(err)
  if (e?.statusCode === 403 && /class windows|windows/i.test(msg)) {
    return 'Windows is not enabled on your Daytona organization yet. Linux works out of the box; contact Daytona to enable the Windows class for your account.'
  }
  if (/not available in region|Region .* is not available/i.test(msg)) {
    return 'This operating system is not available in your Daytona region. Try Linux, or enable this class on your Daytona plan.'
  }
  if (e?.statusCode === 401 || e?.statusCode === 403) {
    return 'Daytona rejected the request (auth/permission). Check DAYTONA_API_KEY and your plan limits.'
  }
  return msg.length > 240 ? msg.slice(0, 240) + '…' : msg
}
