import { getDB } from './db';
import {
  getPendingPayments,
  markPaymentSynced,
  markPaymentFailed,
  getPendingItemAdds,
  markItemAddSynced,
  markItemAddFailed,
} from './offlineHelpers';

export async function syncOfflineOrders() {
  const db = getDB();
  const pendingOrders = await db.offlineOrders
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();

  if (pendingOrders.length === 0) return;

  for (const order of pendingOrders) {
    try {
      await db.offlineOrders.update(order.localId, { syncStatus: 'syncing' });
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (response.status === 402 && errData?.error === 'PLAN_LIMIT_EXCEEDED') {
          throw new Error('PLAN_LIMIT_EXCEEDED');
        }
        throw new Error('Sync failed');
      }

      const serverOrder = await response.json();
      
      await db.offlineOrders.update(order.localId, { 
        syncStatus: 'synced',
        serverId: serverOrder.id
      });
    } catch (error) {
      await db.offlineOrders.update(order.localId, { 
        syncStatus: 'failed',
        syncAttempts: order.syncAttempts + 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function syncOfflinePayments() {
  const pending = await getPendingPayments();
  if (pending.length === 0) return;

  for (const payment of pending) {
    try {
      const res = await fetch(`${API_URL}/api/orders/${payment.orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payment.body,
      });
      if (!res.ok) throw new Error(`Payment sync failed (${res.status})`);
      await markPaymentSynced(payment.localId);
    } catch (error) {
      await markPaymentFailed(payment.localId, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

export async function syncPendingItemAdds() {
  const pending = await getPendingItemAdds();
  if (pending.length === 0) return;

  for (const itemAdd of pending) {
    try {
      const res = await fetch(`${API_URL}/api/orders/${itemAdd.orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: itemAdd.body,
      });
      if (!res.ok) throw new Error(`Item-add sync failed (${res.status})`);
      await markItemAddSynced(itemAdd.localId);
    } catch (error) {
      await markItemAddFailed(itemAdd.localId, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

async function syncAll() {
  // Sequential, not parallel — item-adds and payments both target an
  // order that may itself still be an unsynced local order, so give
  // syncOfflineOrders first crack at resolving real server ids.
  await syncOfflineOrders().catch(console.error);
  await syncPendingItemAdds().catch(console.error);
  await syncOfflinePayments().catch(console.error);
}

// Start background sync polling when online
export function startBackgroundSync(intervalMs = 30000) {
  if (typeof window === 'undefined') return;

  // Sync immediately if online
  if (navigator.onLine) {
    syncAll();
  }

  // Poll
  const interval = setInterval(() => {
    if (navigator.onLine) {
      syncAll();
    }
  }, intervalMs);

  // Listen to network status
  const handleOnline = () => {
    syncAll();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(interval);
    window.removeEventListener('online', handleOnline);
  };
}
