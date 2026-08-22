import { getDB, type CachedMenuItem, type OfflineOrder, type OfflinePayment, type PendingItemAdd } from './db';

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
 *
 * `localId` can be supplied explicitly — e.g. the event-sourced order id
 * from lib/core/commands.ts's createOrder() — so that once this syncs,
 * lib/sync.ts can reconcile the same id back into the view store via
 * reconcileServerId(). Defaults to a fresh id for existing callers that
 * don't have one of their own.
 */
export async function queueOfflineOrder(
  order: Omit<OfflineOrder, 'localId' | 'syncStatus' | 'createdAt' | 'syncAttempts'>,
  localId: string = uuidv4()
): Promise<string> {
  const db = getDB();
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

// ─── Offline Payment Queue ─────────────────────────────────────────────────
//
// Same pattern as the order queue above. `body` is the exact JSON string
// that would have been sent as the PUT /api/orders/:orderId body — stored
// pre-serialized so sync just re-sends it, no need to reconstruct payment
// shape/tax recalculation client-side.

export async function queueOfflinePayment(
  payment: Omit<OfflinePayment, 'localId' | 'syncStatus' | 'createdAt' | 'syncAttempts'>
): Promise<string> {
  const db = getDB();
  const localId = uuidv4();
  await db.offlinePayments.add({
    ...payment,
    localId,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncAttempts: 0,
  });
  return localId;
}

export async function getPendingPayments(): Promise<OfflinePayment[]> {
  const db = getDB();
  return db.offlinePayments.where('syncStatus').anyOf(['pending', 'failed']).sortBy('createdAt');
}

export async function markPaymentSynced(localId: string): Promise<void> {
  const db = getDB();
  await db.offlinePayments.update(localId, { syncStatus: 'synced' });
}

export async function markPaymentFailed(localId: string, errorMessage?: string): Promise<void> {
  const db = getDB();
  await db.offlinePayments.update(localId, { syncStatus: 'failed', errorMessage });
}

// ─── Pending Item-Add Queue ─────────────────────────────────────────────────
//
// For adding items to an order that's already been sent (e.g. already in
// the kitchen). `body` is the exact JSON string for
// POST /api/orders/:orderId/items.

export async function queueItemAdd(
  itemAdd: Omit<PendingItemAdd, 'localId' | 'syncStatus' | 'createdAt' | 'syncAttempts'>
): Promise<string> {
  const db = getDB();
  const localId = uuidv4();
  await db.pendingItemAdds.add({
    ...itemAdd,
    localId,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncAttempts: 0,
  });
  return localId;
}

export async function getPendingItemAdds(): Promise<PendingItemAdd[]> {
  const db = getDB();
  return db.pendingItemAdds.where('syncStatus').anyOf(['pending', 'failed']).sortBy('createdAt');
}

export async function markItemAddSynced(localId: string): Promise<void> {
  const db = getDB();
  await db.pendingItemAdds.update(localId, { syncStatus: 'synced' });
}

export async function markItemAddFailed(localId: string, errorMessage?: string): Promise<void> {
  const db = getDB();
  await db.pendingItemAdds.update(localId, { syncStatus: 'failed', errorMessage });
}
