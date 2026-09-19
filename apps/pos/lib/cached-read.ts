import { edb } from '@/lib/core/event-log';
import { api, ApiError } from '@/lib/api';
import { getPosSession } from '@/lib/pos-session';

function cacheKeyFor(path: string): string {
  const session = getPosSession();
  return `read:${session?.tenantId}:${session?.branchId}:${session?.userId}:${session?.role}:${path}`;
}

/**
 * Whatever `cachedRead` last saved for this path, without touching the
 * network — for a screen that wants to paint instantly from cache and only
 * then let `cachedRead` refresh it in the background, instead of blocking
 * its entire contents behind a live round trip on every open.
 */
export async function peekCachedRead<T>(path: string): Promise<T | null> {
  const cached = await edb.meta.get(cacheKeyFor(path));
  return cached ? (cached.value as { data: T }).data : null;
}

/** Staff/branch/tenant-isolated reference data; never used to authorise a write. */
export async function cachedRead<T>(path: string): Promise<{ data: T; savedAt: string; offline: boolean }> {
  const key = cacheKeyFor(path);
  const cached = await edb.meta.get(key);
  try {
    if (navigator.onLine === false) throw new ApiError('Offline', 0, path);
    const data = await api.get<T>(path);
    const value = { data, savedAt: new Date().toISOString() };
    await edb.meta.put({ key, value }).catch(() => {});
    return { ...value, offline: false };
  } catch (error) {
    // Never bypass an explicit access denial with another user's cached data.
    if (cached && error instanceof ApiError && (error.isNetwork || error.status >= 500)) return { ...cached.value, offline: true };
    throw error;
  }
}
