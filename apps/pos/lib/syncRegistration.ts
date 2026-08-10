/**
 * syncRegistration.ts
 *
 * App-side utilities for registering Background Sync tags with the service worker
 * and triggering manual syncs when the app comes back online.
 *
 * Background Sync API: The browser will call the SW's `sync` event when network
 * connectivity is restored, even if the tab is closed. Falls back to an
 * app-level postMessage trigger for browsers without Background Sync support
 * (e.g., Firefox, Safari).
 */

const SYNC_TAG = 'order-sync';

/**
 * Registers the 'order-sync' Background Sync tag with the service worker.
 * Call this after successfully queuing an offline order to Dexie.
 *
 * The browser will fire the SW's `sync` event as soon as connectivity returns.
 */
export async function registerOrderSync(): Promise<void> {
  if (typeof window === 'undefined') return; // No-op on server

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (!registration) return;

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
    // SW not ready (e.g., first load, or dev mode) — attempt manual sync
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
