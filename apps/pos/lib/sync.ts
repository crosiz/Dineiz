import { getDB } from './db';

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

// Start background sync polling when online
export function startBackgroundSync(intervalMs = 30000) {
  if (typeof window === 'undefined') return;
  
  // Sync immediately if online
  if (navigator.onLine) {
    syncOfflineOrders().catch(console.error);
  }

  // Poll
  const interval = setInterval(() => {
    if (navigator.onLine) {
      syncOfflineOrders().catch(console.error);
    }
  }, intervalMs);

  // Listen to network status
  const handleOnline = () => {
    syncOfflineOrders().catch(console.error);
  };
  
  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(interval);
    window.removeEventListener('online', handleOnline);
  };
}
