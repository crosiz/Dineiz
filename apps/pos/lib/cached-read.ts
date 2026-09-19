import { edb } from '@/lib/core/event-log';
import { api, ApiError } from '@/lib/api';
import { getPosSession } from '@/lib/pos-session';

/** Staff/branch/tenant-isolated reference data; never used to authorise a write. */
export async function cachedRead<T>(path: string): Promise<{ data: T; savedAt: string; offline: boolean }> {
  const session = getPosSession();
  const key = `read:${session?.tenantId}:${session?.branchId}:${session?.userId}:${session?.role}:${path}`;
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
