/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// ─── Constants ────────────────────────────────────────────────────────────────
const DB_NAME = 'DineizGoPOS';
const DB_VERSION = 1;
const STORE_NAME = 'offlineOrders';
const SYNC_TAG = 'order-sync';
const API_URL = self.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : '/api'; // production: same origin via reverse proxy

// ─── IndexedDB Helpers (no Dexie — SW scope only has raw IDB) ─────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getPendingOrders(): Promise<Array<Record<string, unknown>>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('syncStatus');
    const req = index.getAll(IDBKeyRange.only('pending'));
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function updateOrderStatus(
  localId: number,
  status: 'syncing' | 'synced' | 'failed'
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { resolve(); return; }
      const putReq = store.put({ ...record, syncStatus: status });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ─── Order Sync Logic ─────────────────────────────────────────────────────────

async function syncPendingOrders(): Promise<void> {
  const orders = await getPendingOrders();
  if (orders.length === 0) return;

  console.log(`[SW:order-sync] Syncing ${orders.length} pending orders…`);

  for (const order of orders) {
    const localId = order.localId as number;

    try {
      // Mark as syncing to prevent duplicate attempts
      await updateOrderStatus(localId, 'syncing');

      const payload = {
        branchId: order.branchId,
        type: order.type,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        netAmount: order.netAmount,
        notes: order.notes,
        items: order.items,
      };

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await updateOrderStatus(localId, 'synced');
        console.log(`[SW:order-sync] Order ${order.clientRef} synced ✓`);
      } else {
        await updateOrderStatus(localId, 'failed');
        console.warn(`[SW:order-sync] Order ${order.clientRef} failed — HTTP ${res.status}`);
      }
    } catch (err) {
      // Network still unavailable — revert to 'pending' so it can be retried
      await updateOrderStatus(localId, 'failed');
      console.warn(`[SW:order-sync] Order ${order.localId} network error, will retry`, err);
      // Re-throw so the browser knows to retry the sync later
      throw err;
    }
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event: any) => {
  if (event.tag === SYNC_TAG) {
    console.log('[SW:order-sync] Background Sync event fired');
    event.waitUntil(syncPendingOrders());
  }
});

// Notify clients when sync completes so UI can update
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'TRIGGER_SYNC') {
    // Allow manual trigger from app (e.g., when coming back online)
    event.waitUntil(syncPendingOrders());
  }
});

export {};
