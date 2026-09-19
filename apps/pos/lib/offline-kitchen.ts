import { edb } from '@/lib/core/event-log';
import { api, ApiError } from '@/lib/api';
import { getPosSession, getToken } from '@/lib/pos-session';

interface KitchenReady { id: string; orderId: string; branchId: string; actorId: string; state: 'pending' | 'confirmed' | 'rejected'; error?: string }
const PREFIX = 'kitchen-ready:';
export async function kitchenReadyOperations(): Promise<KitchenReady[]> {
  const session = getPosSession();
  return (await edb.meta.where('key').startsWith(PREFIX).toArray()).map(r => r.value)
    .filter(r => r.branchId === session?.branchId);
}
export async function recordKitchenReady(orderId: string) {
  const session = getPosSession();
  if (!session) throw new Error('Sign in before marking an order ready.');
  const id = session.branchId + ':' + orderId;
  await edb.meta.put({ key: PREFIX + id, value: { id, orderId, branchId: session.branchId, actorId: session.userId, state: 'pending' } });
  const { kickOutbox } = await import('@/lib/core/outbox');
  kickOutbox('immediate');
}
export async function replayKitchenReady() {
  for (const op of await kitchenReadyOperations()) {
    if (op.state !== 'pending') continue;
    const { savedTokenFor } = await import('@/lib/offline-auth');
    const token = op.actorId === getPosSession()?.userId ? getToken() : savedTokenFor(op.actorId);
    if (!token) continue;
    try {
      // This endpoint sets a specific batch of items DONE; retrying never
      // toggles them back or advances the order to another state.
      await api.patch(`/api/kds/orders/${encodeURIComponent(op.orderId)}/bump`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await edb.meta.put({ key: PREFIX + op.id, value: { ...op, state: 'confirmed' } });
    } catch (error) {
      const rejected = error instanceof ApiError && [400, 403, 404, 409, 422].includes(error.status);
      await edb.meta.put({ key: PREFIX + op.id, value: { ...op, state: rejected ? 'rejected' : 'pending', error: error instanceof Error ? error.message : 'Waiting for connection' } });
      if (!rejected) return;
    }
  }
}

export async function retryKitchenReady(id: string) {
  const row = await edb.meta.get(PREFIX + id);
  if (!row || row.value.actorId !== getPosSession()?.userId) throw new Error('The staff member who saved this action must sign in to retry.');
  await edb.meta.put({ key: row.key, value: { ...row.value, state: 'pending', error: undefined } });
  const { forceSyncNow } = await import('@/lib/core/outbox');
  forceSyncNow();
}
