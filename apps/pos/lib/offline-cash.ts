import { edb } from '@/lib/core/event-log';
import { api, ApiError } from '@/lib/api';
import { getPosSession, getToken } from '@/lib/pos-session';
import { isShiftPendingOpen, resolveShiftId } from '@/lib/offline-shift';

export interface CashMovement {
  id: string;
  shiftId: string;
  actorId: string;
  branchId?: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  createdAt: string;
  state: 'pending' | 'confirmed' | 'rejected';
  error?: string;
}
const PREFIX = 'cash-entry:';

export async function cashMovements(shiftId?: string): Promise<CashMovement[]> {
  const rows = await edb.meta.where('key').startsWith(PREFIX).toArray();
  return rows.map(r => r.value as CashMovement).filter(r => (!r.branchId || r.branchId === getPosSession()?.branchId) && (!shiftId || resolveShiftId(r.shiftId) === resolveShiftId(shiftId)));
}

/** Save before touching the network. Failure to save must leave the form open. */
export async function recordCashMovement(shiftId: string, type: CashMovement['type'], amount: number, reason: string) {
  const actorId = getPosSession()?.userId;
  if (!actorId || !Number.isFinite(amount) || amount <= 0 || !reason.trim()) throw new Error('Enter a valid amount and reason.');
  const entry: CashMovement = { id: crypto.randomUUID(), shiftId, actorId, branchId: getPosSession()?.branchId, type, amount, reason: reason.trim(), createdAt: new Date().toISOString(), state: 'pending' };
  await edb.meta.put({ key: PREFIX + entry.id, value: entry });
  const { kickOutbox } = await import('@/lib/core/outbox');
  kickOutbox('immediate');
  return entry;
}

export async function replayCashMovements() {
  const session = getPosSession();
  if (!session || navigator.onLine === false) return;
  for (const entry of await cashMovements()) {
    if (entry.state !== 'pending' || isShiftPendingOpen(entry.shiftId)) continue;
    const { savedTokenFor } = await import('@/lib/offline-auth');
    const token = entry.actorId === session.userId ? getToken() : savedTokenFor(entry.actorId);
    if (!token) continue;
    try {
      await api.post(`/api/shifts/${resolveShiftId(entry.shiftId)}/cash-entries`, {
        type: entry.type, amount: entry.amount, reason: entry.reason, clientEntryId: entry.id,
      }, { headers: { Authorization: `Bearer ${token}` } });
      await edb.meta.put({ key: PREFIX + entry.id, value: { ...entry, state: 'confirmed', error: undefined } });
    } catch (error) {
      // Authentication, conflicts and outages can recover. Keep the original
      // operation id so a timeout after a successful write cannot duplicate cash.
      const rejected = error instanceof ApiError && [400, 403, 404, 422].includes(error.status);
      await edb.meta.put({ key: PREFIX + entry.id, value: { ...entry, state: rejected ? 'rejected' : 'pending', error: error instanceof Error ? error.message : 'Waiting for connection' } });
      if (!rejected) return;
    }
  }
}

export async function retryCashMovement(id: string) {
  const row = await edb.meta.get(PREFIX + id);
  if (!row || row.value.actorId !== getPosSession()?.userId) throw new Error('The cashier who saved this movement must sign in to retry.');
  await edb.meta.put({ key: row.key, value: { ...row.value, state: 'pending', error: undefined } });
  const { forceSyncNow } = await import('@/lib/core/outbox');
  forceSyncNow();
}
