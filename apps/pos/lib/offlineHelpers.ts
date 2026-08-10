import { getDB, type CachedMenuItem, type OfflineOrder } from './db';

// ─── Menu Caching ─────────────────────────────────────────────────────────────

/**
 * Replaces all cached menu items for a given tenant with fresh data from the API.
 */
export async function syncMenuToCache(
  tenantId: string,
  items: CachedMenuItem[]
): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.menuItems, async () => {
    // Remove stale items for this tenant
    await db.menuItems.where('tenantId').equals(tenantId).delete();
    // Bulk insert the fresh data
    await db.menuItems.bulkAdd(items);
  });
}

/**
 * Reads the entire cached menu from IndexedDB for a tenant.
 */
export async function getMenuFromCache(tenantId: string): Promise<CachedMenuItem[]> {
  const db = getDB();
  return db.menuItems
    .where('tenantId')
    .equals(tenantId)
    .and((item) => item.isAvailable)
    .sortBy('sortOrder');
}

// ─── Offline Order Queue ──────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';

/**
 * Saves an order to the local IndexedDB queue when offline or before sync.
 */
export async function queueOfflineOrder(
  order: Omit<OfflineOrder, 'localId' | 'syncStatus' | 'createdAt' | 'syncAttempts'>
): Promise<string> {
  const db = getDB();
  const localId = uuidv4();
  await db.offlineOrders.add({
    ...order,
    localId,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncAttempts: 0,
  });
  return localId;
}

/**
 * Returns all pending offline orders that have not yet been synced.
 */
export async function getPendingOrders(): Promise<OfflineOrder[]> {
  const db = getDB();
  return db.offlineOrders
    .where('syncStatus')
    .equals('pending')
    .sortBy('createdAt');
}

/**
 * Marks a local order as synced after it's been successfully posted to the API.
 */
export async function markOrderSynced(localId: string): Promise<void> {
  const db = getDB();
  await db.offlineOrders.update(localId, { syncStatus: 'synced' });
}

/**
 * Marks a local order as failed after a sync attempt.
 */
export async function markOrderFailed(localId: string): Promise<void> {
  const db = getDB();
  await db.offlineOrders.update(localId, { syncStatus: 'failed' });
}

/**
 * Purges all synced orders older than 7 days to prevent IndexedDB from growing too large.
 */
export async function pruneOldOrders(): Promise<void> {
  const db = getDB();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  await db.offlineOrders
    .where('syncStatus')
    .equals('synced')
    .filter((o) => new Date(o.createdAt).getTime() < cutoff)
    .delete();
}
