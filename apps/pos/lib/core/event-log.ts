import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';

export type EventType =
  // Order lifecycle
  | 'ORDER_CREATED' | 'ITEM_ADDED' | 'ITEM_REMOVED' | 'ITEM_VOIDED'
  | 'ITEM_QTY_CHANGED' | 'ITEM_NOTE_CHANGED' | 'ORDER_NOTE_CHANGED'
  | 'DISCOUNT_APPLIED' | 'DISCOUNT_REMOVED'
  | 'ORDER_SENT_TO_KITCHEN' | 'ORDER_MARKED_READY' | 'ORDER_SERVED'
  | 'ORDER_COMPLETED' | 'PAYMENT_COLLECTED'
  | 'ORDER_CANCELLED' | 'ORDER_VOIDED' | 'ORDER_WALKED_OUT'
  | 'CUSTOMER_ATTACHED'
  // Table lifecycle
  | 'TABLE_STATUS_CHANGED' | 'TABLE_MERGED' | 'TABLE_SPLIT'
  | 'ORDER_MOVED_TO_TABLE' | 'WAITER_ASSIGNED'
  // Shift lifecycle
  | 'SHIFT_OPENED' | 'BREAK_STARTED' | 'BREAK_ENDED'
  | 'CASH_IN' | 'CASH_OUT' | 'SHIFT_CLOSED'
  // Print and audit
  | 'KOT_PRINTED' | 'BILL_PRINTED' | 'RECEIPT_PRINTED'
  | 'CANCELLATION_KOT_PRINTED' | 'MANAGER_APPROVED' | 'MANAGER_DENIED';

export type SyncState =
  | 'LOCAL'      // just created, not yet queued
  | 'QUEUED'     // in outbox, waiting to ship
  | 'BLOCKED'    // dependency not yet confirmed
  | 'INFLIGHT'   // HTTP request in progress
  | 'CONFIRMED'  // server acknowledged
  | 'DEGRADED'   // failing but still retrying
  | 'POISONED';  // permanent failure, needs human review

export interface PosEvent {
  id: string;              // client-generated, globally unique
  seq: number;              // monotonic Lamport counter per terminal
  type: EventType;
  aggregateId: string;      // orderId | tableId | shiftId
  aggregateType: 'ORDER' | 'TABLE' | 'SHIFT';
  payload: any;
  dependsOn: string[];      // event ids that must confirm first
  terminalId: string;
  actorId: string;
  actorName: string;
  shiftId: string;
  branchId: string;
  tenantId: string;
  clientTime: string;       // ISO, may be skewed
  syncState: SyncState;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  confirmedAt: string | null;
}

class EventDB extends Dexie {
  events!: Table<PosEvent, string>;
  views!: Table<{ key: string; value: any; version: number }, string>;
  drafts!: Table<{ key: string; value: any; savedAt: string }, string>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('DineizPOS_EventStore_v1');
    this.version(1).stores({
      events: 'id, seq, type, aggregateId, syncState, [syncState+seq]',
      views: 'key',
      drafts: 'key',
      meta: 'key',
    });
  }
}

export const edb = new EventDB();

// ─── Terminal identity: permanent, assigned once ────────────────────────────

export async function getTerminalId(): Promise<string> {
  const row = await edb.meta.get('terminalId');
  if (!row) {
    // Short A-Z-ish suffix so order numbers stay compact
    const id = nanoid(6).toUpperCase();
    await edb.meta.put({ key: 'terminalId', value: id });
    return id;
  }
  return row.value;
}

export async function getTerminalPrefix(): Promise<string> {
  const id = await getTerminalId();
  return id.slice(0, 1); // single char prefix: A, B, C...
}

// ─── Lamport counter: monotonic, never resets, ordering guarantee ──────────

let seqCache: number | null = null;

export async function nextSeq(): Promise<number> {
  if (seqCache === null) {
    const row = await edb.meta.get('seq');
    seqCache = (row?.value as number | undefined) ?? 0;
  }
  const next = (seqCache ?? 0) + 1;
  seqCache = next;
  edb.meta.put({ key: 'seq', value: next }).catch(console.error);
  return next;
}

// ─── Order number: CLIENT GENERATED, permanent — never reconciled against a
// server-assigned one. See the Phase 1 plan: orderNumber has no DB-level
// uniqueness constraint today and nothing parses its structure, so there is
// no format contract to preserve, only a uniqueness guarantee to add
// (terminal prefix + per-shift sequence makes collisions structurally
// impossible across terminals). ─────────────────────────────────────────────

export async function nextOrderNumber(shiftId: string): Promise<string> {
  const key = `orderSeq:${shiftId || 'noshift'}`;
  const row = await edb.meta.get(key);
  const n = (row?.value ?? 0) + 1;
  await edb.meta.put({ key, value: n });
  const prefix = await getTerminalPrefix();
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

// ─── Append: the ONLY way state changes ─────────────────────────────────────

export async function append(
  type: EventType,
  aggregateType: PosEvent['aggregateType'],
  aggregateId: string,
  payload: any,
  dependsOn: string[] = []
): Promise<PosEvent> {
  const session = JSON.parse(localStorage.getItem('pos_session') ?? '{}');
  const shift = JSON.parse(localStorage.getItem('pos_shift') ?? '{}');
  const event: PosEvent = {
    id: `evt_${nanoid(16)}`,
    seq: await nextSeq(),
    type, aggregateType, aggregateId, payload, dependsOn,
    terminalId: await getTerminalId(),
    actorId: session.userId ?? 'unknown',
    actorName: session.name ?? 'unknown',
    shiftId: shift.shiftId ?? '',
    branchId: session.branchId ?? '',
    tenantId: session.tenantId ?? '',
    clientTime: new Date().toISOString(),
    syncState: dependsOn.length > 0 ? 'BLOCKED' : 'QUEUED',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    confirmedAt: null,
  };
  await edb.events.add(event);
  return event;
}
