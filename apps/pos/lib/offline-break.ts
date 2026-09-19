import { edb } from '@/lib/core/event-log';
import { api, ApiError } from '@/lib/api';
import { getPosSession, getToken } from '@/lib/pos-session';
import { isShiftPendingOpen, resolveShiftId } from '@/lib/offline-shift';

export interface SavedBreak {
  id: string; shiftId: string; actorId: string; branchId: string;
  startedAt: string; endedAt?: string;
  state: 'pending' | 'confirmed' | 'rejected'; error?: string;
}
const PREFIX = 'shift-break:';
export async function savedBreaks(shiftId?: string): Promise<SavedBreak[]> {
  return (await edb.meta.where('key').startsWith(PREFIX).toArray()).map(r => r.value)
    .filter(b => b.branchId === getPosSession()?.branchId && (!shiftId || resolveShiftId(b.shiftId) === resolveShiftId(shiftId)));
}
export async function startSavedBreak(shiftId: string) {
  const session = getPosSession();
  if (!session) throw new Error('Sign in before starting a break.');
  const active = (await savedBreaks(shiftId)).find(b => b.actorId === session.userId && !b.endedAt);
  if (active) return active;
  const entry: SavedBreak = { id: crypto.randomUUID(), shiftId, actorId: session.userId, branchId: session.branchId, startedAt: new Date().toISOString(), state: 'pending' };
  await edb.meta.put({ key: PREFIX + entry.id, value: entry });
  const { kickOutbox } = await import('@/lib/core/outbox');
  kickOutbox('immediate');
  return entry;
}
export async function endSavedBreak(id: string, endedAt: string): Promise<boolean> {
  const row = await edb.meta.get(PREFIX + id);
  if (!row) return false; // A break made by an older app uses its legacy endpoint.
  if (row.value.actorId !== getPosSession()?.userId) throw new Error('Only the staff member who started this break can end it.');
  await edb.meta.put({ key: row.key, value: { ...row.value, endedAt, state: 'pending', error: undefined } });
  const { kickOutbox } = await import('@/lib/core/outbox');
  kickOutbox('immediate');
  return true;
}
export async function replaySavedBreaks() {
  for (const entry of await savedBreaks()) {
    if (entry.state !== 'pending' || isShiftPendingOpen(entry.shiftId)) continue;
    const { savedTokenFor } = await import('@/lib/offline-auth');
    const token = entry.actorId === getPosSession()?.userId ? getToken() : savedTokenFor(entry.actorId);
    if (!token) continue;
    try {
      await api.post(`/api/shifts/${resolveShiftId(entry.shiftId)}/break/replay`, {
        clientBreakId: entry.id, startedAt: entry.startedAt, endedAt: entry.endedAt,
      }, { headers: { Authorization: `Bearer ${token}` } });
      // Do not overwrite a break end saved while its start was in flight.
      const current = await edb.meta.get(PREFIX + entry.id);
      if (current?.value.endedAt === entry.endedAt) await edb.meta.put({ key: PREFIX + entry.id, value: { ...entry, state: 'confirmed', error: undefined } });
    } catch (error) {
      const current = await edb.meta.get(PREFIX + entry.id);
      if (current?.value.endedAt !== entry.endedAt) continue;
      const rejected = error instanceof ApiError && [400, 403, 404, 422].includes(error.status);
      await edb.meta.put({ key: PREFIX + entry.id, value: { ...entry, state: rejected ? 'rejected' : 'pending', error: error instanceof Error ? error.message : 'Waiting for connection' } });
      if (!rejected) return;
    }
  }
}
export async function retrySavedBreak(id: string) {
  const row = await edb.meta.get(PREFIX + id);
  if (!row || row.value.actorId !== getPosSession()?.userId) throw new Error('The staff member who saved this break must sign in to retry.');
  await edb.meta.put({ key: row.key, value: { ...row.value, state: 'pending', error: undefined } });
  const { forceSyncNow } = await import('@/lib/core/outbox');
  forceSyncNow();
}
