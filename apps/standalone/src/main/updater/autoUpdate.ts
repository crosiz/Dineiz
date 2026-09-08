import { autoUpdater } from 'electron-updater'

export type UpdateCheckResult =
  | { status: 'not-configured' }
  | { status: 'up-to-date' }
  | { status: 'update-available'; version: string }
  | { status: 'error'; message: string }

/**
 * Real auto-updates need a purchased code-signing certificate and a hosted
 * update feed (electron-builder's `publish` config) — neither exists yet.
 * Flip this to true (and add a `publish:` block to electron-builder.yml)
 * once that infrastructure is actually set up; until then this stays a
 * hard-coded constant rather than something that tries to detect feed
 * config at runtime, so "not configured" is always exactly true, never a
 * guess. User-triggered only, never silent/background — the one exception
 * to this app's zero-network-calls-at-runtime rule is when the user
 * explicitly asks by clicking this.
 */
const UPDATE_FEED_CONFIGURED = false

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!UPDATE_FEED_CONFIGURED) {
    return { status: 'not-configured' }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    const latestVersion = result?.updateInfo.version
    if (latestVersion && latestVersion !== autoUpdater.currentVersion.version) {
      return { status: 'update-available', version: latestVersion }
    }
    return { status: 'up-to-date' }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}
