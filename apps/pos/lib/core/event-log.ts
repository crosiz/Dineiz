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
  | 'ORDER_ADOPTED'
  | 'CUSTOMER_ATTACHED' | 'BILL_REQUESTED'
  // Table lifecycle
  | 'TABLE_STATUS_CHANGED' | 'TABLE_CLEANED' | 'TABLE_MERGED' | 'TABLE_SPLIT'
  | 'ORDER_MOVED_TO_TABLE' | 'WAITER_ASSIGNED'
  // Shift lifecycle
  | 'SHIFT_OPENED' | 'BREAK_STARTED' | 'BREAK_ENDED'
  | 'CASH_IN' | 'CASH_OUT' | 'SHIFT_CLOSED' | 'SHIFT_SYNC_COMPLETED'
  // Print and audit
  | 'KOT_PRINTED' | 'BILL_PRINTED' | 'RECEIPT_PRINTED'
  | 'CANCELLATION_KOT_PRINTED' | 'MANAGER_APPROVED' | 'MANAGER_DENIED'
  | 'AUDIT_MANAGER_OVERRIDE_STARTED' | 'AUDIT_MANAGER_OVERRIDE_ENDED';

export type SyncState =
  // ── non-terminal — an event WILL leave these within a bounded time ──
  | 'LOCAL'      // just created, not yet queued
  | 'QUEUED'     // in outbox, waiting to ship
  | 'BLOCKED'    // dependency not yet confirmed
  | 'INFLIGHT'   // HTTP request in progress
  | 'DEGRADED'   // failing but still retrying
  // ── terminal — an event never leaves these (spec Part 5) ──
  | 'CONFIRMED'  // server accepted
  | 'POISONED'   // permanent failure, needs a human
  | 'ABANDONED'  // exceeded max lifetime (24h) — dead-lettered
  | 'SUPERSEDED';// a later event for the same aggregate replaced this one

export const NON_TERMINAL_STATES: SyncState[] = ['LOCAL', 'QUEUED', 'BLOCKED', 'INFLIGHT', 'DEGRADED'];
export const TERMINAL_STATES: SyncState[] = ['CONFIRMED', 'POISONED', 'ABANDONED', 'SUPERSEDED'];

// An event that hasn't reached a terminal state within this long is
// ABANDONED by the watchdog and routed to the dead-letter queue with its
// full payload — nothing is allowed to retry forever.
export const EVENT_MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;

// ── Priority lanes (spec Part 5) ──────────────────────────────────────────
// Lanes ship in parallel; a slow LOW batch never delays a payment.
export type SyncLane = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

const CRITICAL_EVENTS = new Set<EventType>(['PAYMENT_COLLECTED', 'ORDER_VOIDED', 'SHIFT_CLOSED']);
const HIGH_EVENTS = new Set<EventType>(['ORDER_CREATED', 'ORDER_SENT_TO_KITCHEN']);
const LOW_EVENTS = new Set<EventType>([
  'KOT_PRINTED', 'BILL_PRINTED', 'RECEIPT_PRINTED', 'CANCELLATION_KOT_PRINTED',
]);

export function laneForEvent(type: EventType): SyncLane {
  if (CRITICAL_EVENTS.has(type)) return 'CRITICAL';
  if (HIGH_EVENTS.has(type)) return 'HIGH';
  if (LOW_EVENTS.has(type)) return 'LOW';
  return 'NORMAL';
}

const LANE_RANK: Record<SyncLane, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
/** Highest-priority (lowest rank) lane among a set of event types. */
export function laneForEvents(types: EventType[]): SyncLane {
  let best: SyncLane = 'LOW';
  for (const t of types) {
    const l = laneForEvent(t);
    if (LANE_RANK[l] < LANE_RANK[best]) best = l;
  }
  return best;
}

export interface PosEvent {
  id: string;              // client-generated, globally unique
  seq: number;              // monotonic Lamport counter per terminal
  type: EventType;
  aggregateId: string;      // orderId | tableId | shiftId
  aggregateType: 'ORDER' | 'TABLE' | 'SHIFT';
  payload: any;
  dependsOn: string[];      // event ids that must confirm first
  terminalId: string;
  actorId: string;         // the CASHIER — whose shift/terminal this is
  actorName: string;
  // Dual attribution (spec Part 10). Set on every event created while a
  // manager overlay is active: revenue/shift stay with the cashier above,
  // the authorisation is the manager here.
  overrideById: string | null;
  overrideByName: string | null;
  overrideReason: string | null;
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

// ─── Order number: CLIENT GENERATED, permanent (spec Part 4) ────────────────
//
// The terminal owns this. It's minted here the instant an order is created and
// the server trusts it verbatim (apps/api/src/routes/order/order.service.ts's
// createOrder). `@@unique([tenantId, orderNumber])` is the collision backstop;
// terminal prefix + date + per-terminal sequence makes a real collision
// structurally impossible across terminals.
//
// Format is configurable per tenant (Admin → Settings → Orders). This mirrors
// formatOrderNumber() in apps/api/src/lib/orderNumber.ts — keep the two in
// sync; they can't share a module across the app boundary.
//
//   SHORT     A-047             per-shift sequence
//   STANDARD  A-0912-047        DDMM  + per-day sequence   (default)
//   DETAILED  KBJ-A-250912-047  YYMMDD + per-day sequence

type OrderNumberFormat = 'SHORT' | 'STANDARD' | 'DETAILED';

function readOrderNumberFormat(): { format: OrderNumberFormat; shortCode: string } {
  try {
    const b = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const raw = String(b.orderNumberFormat ?? b.pos?.orderNumberFormat ?? 'STANDARD').toUpperCase();
    const format = (['SHORT', 'STANDARD', 'DETAILED'].includes(raw) ? raw : 'STANDARD') as OrderNumberFormat;
    const shortCode = String(b.tenantShortCode ?? b.pos?.tenantShortCode ?? '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    return { format, shortCode };
  } catch {
    return { format: 'STANDARD', shortCode: '' };
  }
}

export async function nextOrderNumber(shiftId: string): Promise<string> {
  const { format, shortCode } = readOrderNumberFormat();
  const prefix = await getTerminalPrefix();
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);

  // SHORT resets per shift; the dated formats reset per day.
  const seqKey =
    format === 'SHORT'
      ? `orderSeq:${shiftId || 'noshift'}`
      : `orderSeq:${prefix}:${now.getFullYear()}${mm}${dd}`;
  const row = await edb.meta.get(seqKey);
  const n = (row?.value ?? 0) + 1;
  await edb.meta.put({ key: seqKey, value: n });
  const seq = String(n).padStart(3, '0');

  if (format === 'SHORT') return `${prefix}-${seq}`;
  if (format === 'DETAILED') return `${shortCode ? `${shortCode}-` : ''}${prefix}-${yy}${mm}${dd}-${seq}`;
  return `${prefix}-${dd}${mm}-${seq}`;
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
  // Dual attribution (spec Part 10) — inlined rather than importing the
  // overlay store to avoid a cycle; this reads the same localStorage the
  // store writes.
  let override = { overrideById: null as string | null, overrideByName: null as string | null, overrideReason: null as string | null };
  try {
    const o = JSON.parse(localStorage.getItem('pos_manager_overlay') ?? 'null');
    if (o?.managerId) override = { overrideById: o.managerId, overrideByName: o.managerName ?? null, overrideReason: o.reason || null };
  } catch { /* ignore */ }

  const event: PosEvent = {
    id: `evt_${nanoid(16)}`,
    seq: await nextSeq(),
    type, aggregateType, aggregateId, payload, dependsOn,
    terminalId: await getTerminalId(),
    actorId: session.userId ?? 'unknown',
    actorName: session.name ?? 'unknown',
    overrideById: override.overrideById,
    overrideByName: override.overrideByName,
    overrideReason: override.overrideReason,
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
  try {
    await edb.events.add(event);
  } catch (err: any) {
    // Spec Part 12 — IndexedDB quota exceeded. Free space by dropping
    // already-terminal events, then retry once. The append MUST succeed:
    // an event that never lands is silently lost work.
    if (err?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? '')) {
      const { emergencyPrune } = await import('./views');
      await emergencyPrune();
      await edb.events.add(event);
    } else {
      throw err;
    }
  }
  return event;
}
