/**
 * syncRegistration.ts
 *
 * App-side utilities for registering Background Sync tags with the service worker
 * and triggering manual syncs when the app comes back online.
 *
 * Background Sync API: The browser will call the SW's `sync` event when network
 * connectivity is restored, even if the tab is closed. This is a best-effort
 * progressive enhancement only — the app is never allowed to depend on it, because:
 *   - No service worker exists at all in dev (`next dev --turbopack`): next-pwa
 *     injects itself via next.config's webpack() hook, which Turbopack does not run.
 *   - Safari/Firefox don't support the Background Sync API.
 *   - A first-time visit may not have an active SW yet.
 * `lib/sync.ts`'s `startBackgroundSync()` (setInterval + `online` listener, pure
 * Dexie, no SW required) is the actual, reliable sync mechanism in every
 * environment. Everything below is skipped safely, with a hard timeout, whenever
 * no SW is available so callers (e.g. CheckoutModal) never hang.
 */

const SYNC_TAG = 'order-sync';
const SW_READY_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(undefined); },
    );
  });
}

/**
 * Registers the 'order-sync' Background Sync tag with the service worker, if one
 * is active. Call this after successfully queuing an offline order to Dexie —
 * it never throws and never blocks longer than SW_READY_TIMEOUT_MS, since the
 * order is already safely persisted locally by the time this runs.
 */
export async function registerOrderSync(): Promise<void> {
  if (typeof window === 'undefined') return; // No-op on server
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, SW_READY_TIMEOUT_MS);
    if (!registration) {
      // No active SW (dev mode, first load, or unsupported browser) —
      // lib/sync.ts's polling loop will pick this order up instead.
      return;
    }

    // Use native Background Sync API if available (Chrome, Edge)
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
      console.log('[BGSync] Registered sync tag:', SYNC_TAG);
    } else {
      // Fallback: trigger sync via postMessage (app must be open)
      triggerManualSync();
    }
  } catch (err) {
    // SW not ready — lib/sync.ts's polling loop remains the fallback
    console.warn('[BGSync] Could not register sync tag, falling back to manual trigger', err);
    triggerManualSync();
  }
}

/**
 * Sends a TRIGGER_SYNC message directly to the active service worker.
 * Used as a fallback for browsers without Background Sync support,
 * and also called when the app detects the `online` event.
 */
export function triggerManualSync(): void {
  if (typeof window === 'undefined') return;

  navigator.serviceWorker?.controller?.postMessage({ type: 'TRIGGER_SYNC' });
}

/**
 * Registers an `online` event listener that triggers a SW sync whenever
 * the browser comes back online. Call this once in the app root.
 */
export function registerOnlineSyncListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    console.log('[BGSync] Network restored — triggering order sync');
    void registerOrderSync();
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}

/**
 * Checks whether the Background Sync API is supported in this browser.
 * Useful for rendering a "sync pending" UI badge.
 */
export function isBackgroundSyncSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}
