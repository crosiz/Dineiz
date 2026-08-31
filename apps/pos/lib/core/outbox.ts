import {
  edb, type PosEvent, type SyncLane,
  NON_TERMINAL_STATES, EVENT_MAX_LIFETIME_MS, laneForEvents,
} from './event-log';
import { useViews, reconcileServerId, emergencyPrune } from './views';
import { getToken, getPosSession } from '@/lib/pos-session';
import { toast } from 'sonner';

// ─── The outbox: ships local events to the server (spec Part 5) ────────────
//
// The event log (event-log.ts) is the durable source of truth and retry
// ledger. This module drains it to the server with a hard terminal-state
// guarantee: every event reaches CONFIRMED / POISONED / ABANDONED /
// SUPERSEDED within a bounded time — no state can be entered but never left.
//
//   • events → a small set of typed *tasks* per aggregate (deriveTaskChains)
//   • tasks  → priority lanes; CRITICAL ships alone and immediately, the
//              rest batch up to 50 ops into ONE `POST /api/pos/events/batch`
//   • adaptive concurrency + batch size from measured round-trip time
//   • circuit breaker with a /health probe when the network is dying
//   • a 60s watchdog (24h max lifetime → ABANDONED), a 30s BLOCKED re-eval
//     (a dependent of a dead event dies too, never waits), and a stall
//     detector that restarts the engine if the queue stops draining while
//     the network is up
//
// A real raw-event ingestion endpoint is a later phase; until then the batch
// endpoint runs each op through the same domain services the individual REST
// endpoints use, so there is one code path for the business logic.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;      // spec: hard 8s AbortController
const DEFAULT_MAX_LIFETIME_MS = EVENT_MAX_LIFETIME_MS; // 24h from event-log.ts
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];
const DEGRADED_RETRY_MS = 60000;
const CRITICAL_RETRY_MS = [500, 1000, 2000];  // spec: 3 fast retries for CRITICAL

// Part 13 — the sync engine's tunables live in console settings and reach
// the terminal in pos_branding. Read live (cheap) with sane fallbacks.
function syncCfg(): { requestTimeoutMs: number; maxLifetimeMs: number; maxBatchSize: number } {
  try {
    const b = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const p = { ...(b.pos ?? {}), ...b };
    const timeout = Number(p.syncRequestTimeoutMs);
    const lifeHrs = Number(p.syncMaxEventLifetimeHours);
    const batch = Number(p.syncBatchSize);
    return {
      requestTimeoutMs: Number.isFinite(timeout) && timeout >= 1000 ? timeout : DEFAULT_REQUEST_TIMEOUT_MS,
      maxLifetimeMs: Number.isFinite(lifeHrs) && lifeHrs > 0 ? lifeHrs * 3_600_000 : DEFAULT_MAX_LIFETIME_MS,
      maxBatchSize: Number.isFinite(batch) && batch >= 1 ? batch : 50,
    };
  } catch {
    return { requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS, maxLifetimeMs: DEFAULT_MAX_LIFETIME_MS, maxBatchSize: 50 };
  }
}

const CIRCUIT_TRIP_THRESHOLD = 3;
const CIRCUIT_PROBE_INTERVAL_MS = 15000;
const CIRCUIT_CLOSE_THRESHOLD = 2;

const WATCHDOG_INTERVAL_MS = 60_000;
const BLOCKED_REEVAL_INTERVAL_MS = 30_000;
const STALL_SAMPLE_INTERVAL_MS = 30_000;
const STALL_RESTART_AFTER_MS = 3 * 60_000;    // no progress for 3 min while online → restart

// Adaptive tiers, keyed on recent round-trip time (spec Part 5).
const ADAPTIVE_TIERS = [
  { maxRtt: 200, concurrency: 6, batchSize: 50 },
  { maxRtt: 800, concurrency: 3, batchSize: 30 },
  { maxRtt: 2000, concurrency: 2, batchSize: 15 },
  { maxRtt: Infinity, concurrency: 1, batchSize: 10 },
];

type TaskKind =
  | 'CREATE_ORDER' | 'ADD_ITEMS' | 'UPDATE_STATUS' | 'COLLECT_PAYMENT'
  | 'UPDATE_TABLE_STATUS' | 'REQUEST_BILL' | 'CLEAN_TABLE';

interface OutboxTask {
  kind: TaskKind;
  aggregateId: string;
  eventIds: string[];
  lane: SyncLane;
  status?: string;                 // UPDATE_STATUS / UPDATE_TABLE_STATUS
  billRequestedAt?: string | null; // REQUEST_BILL
}

// ─── Module state ────────────────────────────────────────────────────────

let draining = false;
let kickScheduled: ReturnType<typeof setTimeout> | null = null;
let started = false;
let handles: Array<ReturnType<typeof setInterval>> = [];

let circuitOpen = false;
let consecutiveFailures = 0;
let consecutiveProbeSuccesses = 0;
let probeHandle: ReturnType<typeof setInterval> | null = null;

let batchEndpointAvailable = true;   // flipped off on a 404, re-probed on restart
const rttSamples: number[] = [];     // recent batch round-trip times (ms)

// Stall detector bookkeeping.
let lastNonTerminalCount = -1;
let lastProgressAt = Date.now();

// ─── HTTP helpers ────────────────────────────────────────────────────────

function authHeaders(idempotencyKey?: string): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  timeoutMs = timeoutMs ?? syncCfg().requestTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Distinguishes a connectivity/server problem (retry with backoff, counts
// toward the circuit breaker) from a real rejection by the server (the
// request reached it and it said no — retrying the same body won't help).
class TaskError extends Error {
  permanent: boolean;
  authExpired: boolean;
  graceRetries: number; // extra retries before POISON even for a "permanent" error
  constructor(message: string, permanent: boolean, opts: { authExpired?: boolean; graceRetries?: number } = {}) {
    super(message);
    this.permanent = permanent;
    this.authExpired = opts.authExpired ?? false;
    this.graceRetries = opts.graceRetries ?? 0;
  }
}

const AUTH_EXPIRED_ERROR = 'AUTH_EXPIRED';

function classifyHttpError(status: number): TaskError {
  if (status === 401) return new TaskError(AUTH_EXPIRED_ERROR, false, { authExpired: true });
  if (status === 403 || status === 408 || status === 429 || status >= 500) return new TaskError(`HTTP ${status}`, false);
  // 4xx the request reached the server and it said no. 409 is race-prone
  // (e.g. a duplicate that resolves itself) so it gets one grace retry;
  // 400/404/422 poison on the first failure (spec Part 12).
  return new TaskError(`HTTP ${status}`, true, { graceRetries: status === 409 ? 1 : 0 });
}

// ─── Adaptive concurrency / batch size ───────────────────────────────────

function recordRtt(ms: number): void {
  rttSamples.push(ms);
  if (rttSamples.length > 12) rttSamples.shift();
}

function currentTier() {
  const cap = syncCfg().maxBatchSize;
  const base = rttSamples.length === 0
    ? ADAPTIVE_TIERS[1] // optimistic-ish default
    : (() => {
        const sorted = [...rttSamples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return ADAPTIVE_TIERS.find((t) => median <= t.maxRtt)!;
      })();
  // The console-configured batch size is a ceiling; a slow link still uses a
  // smaller adaptive size.
  return { ...base, batchSize: Math.min(base.batchSize, cap) };
}

// ─── Task derivation — collapses queued events per aggregate ──────────────

function delayForAttempts(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts > BACKOFF_MS.length) return DEGRADED_RETRY_MS;
  return BACKOFF_MS[attempts - 1];
}

function isDue(e: PosEvent, now: number): boolean {
  if (e.syncState === 'QUEUED' || e.syncState === 'BLOCKED') return true;
  if (e.syncState !== 'DEGRADED') return false;
  if (!e.lastAttemptAt) return true;
  return now - new Date(e.lastAttemptAt).getTime() >= delayForAttempts(e.attempts);
}

async function deriveTaskChains(): Promise<Map<string, OutboxTask[]>> {
  const candidates = await edb.events.where('syncState').anyOf(['QUEUED', 'BLOCKED', 'DEGRADED']).toArray();
  const now = Date.now();
  const ready = candidates.filter((e) => isDue(e, now)).sort((a, b) => a.seq - b.seq);

  const byAggregate = new Map<string, PosEvent[]>();
  for (const e of ready) {
    if (!byAggregate.has(e.aggregateId)) byAggregate.set(e.aggregateId, []);
    byAggregate.get(e.aggregateId)!.push(e);
  }

  const chains = new Map<string, OutboxTask[]>();
  const orders = useViews.getState().orders;

  // Collapse a run of same-type events into a single task keyed on the
  // LATEST; the earlier ones are genuinely obsolete → mark them SUPERSEDED
  // (terminal) so they never ship on their own or count toward retries.
  const collapse = (events: PosEvent[]): PosEvent | null => {
    if (events.length === 0) return null;
    const latest = events[events.length - 1];
    const superseded = events.slice(0, -1).map((e) => e.id);
    if (superseded.length) markSuperseded(superseded);
    return latest;
  };

  for (const [aggregateId, events] of Array.from(byAggregate)) {
    const aggType = events[0].aggregateType;
    const chain: OutboxTask[] = [];
    const laneOf = (evs: PosEvent[]): SyncLane => laneForEvents(evs.map((e) => e.type));

    if (aggType === 'TABLE') {
      const statusEvents = events.filter((e) => e.type === 'TABLE_STATUS_CHANGED');
      const latestStatus = collapse(statusEvents);
      if (latestStatus) {
        chain.push({ kind: 'UPDATE_TABLE_STATUS', aggregateId, status: latestStatus.payload.status, eventIds: [latestStatus.id], lane: laneOf([latestStatus]) });
      }
      const cleanEvents = events.filter((e) => e.type === 'TABLE_CLEANED');
      if (cleanEvents.length) {
        chain.push({ kind: 'CLEAN_TABLE', aggregateId, eventIds: cleanEvents.map((e) => e.id), lane: laneOf(cleanEvents) });
      }
      // TABLE_MERGED / TABLE_SPLIT have no server endpoint yet — local-only.
      const handledTable = new Set([...statusEvents, ...cleanEvents].map((e) => e.id));
      const leftoverTable = events.filter((e) => !handledTable.has(e.id));
      if (leftoverTable.length) markConfirmed(leftoverTable.map((e) => e.id));
    } else if (aggType === 'SHIFT') {
      // Shift-lifecycle events ship synchronously from their own call sites
      // (POST /api/shifts/:id/open|close, and the pending-sync finalisation in
      // markShiftPendingSync/finalisePendingSyncShiftIfDrained). Recorded here
      // only for the local audit trail — nothing to queue.
      markConfirmed(events.map((e) => e.id));
      continue;
    } else {
      // ORDER
      const order = orders[aggregateId];
      const hasServerId = !!order?.serverId;

      if (!hasServerId) {
        // The server has never seen this order — create it, carrying every
        // pending event for it. Previously this also required a pending
        // ORDER_SENT_TO_KITCHEN event, so an order whose create/send had
        // already been confirmed in an earlier session (or whose create had
        // failed) matched NEITHER branch: no task was built and the events
        // were never confirmed either. They sat QUEUED forever — the queue
        // count never moved, Force Sync appeared to do nothing, and the
        // stall detector restarted the engine on a loop. An order we can't
        // create yet (nothing in the store) is handled by the guard below.
        if (order) {
          chain.push({ kind: 'CREATE_ORDER', aggregateId, eventIds: events.map((e) => e.id), lane: laneOf(events) });
        }
      } else {
        const itemEvents = events.filter((e) => e.type === 'ITEM_ADDED');
        const statusEvents = events.filter((e) =>
          ['ORDER_MARKED_READY', 'ORDER_SERVED', 'ORDER_CANCELLED', 'ORDER_VOIDED', 'ORDER_WALKED_OUT'].includes(e.type),
        );
        const paymentEvents = events.filter((e) => e.type === 'PAYMENT_COLLECTED');
        const billEvents = events.filter((e) => e.type === 'BILL_REQUESTED');

        if (itemEvents.length) {
          chain.push({ kind: 'ADD_ITEMS', aggregateId, eventIds: itemEvents.map((e) => e.id), lane: laneOf(itemEvents) });
        }
        const latestBill = collapse(billEvents);
        if (latestBill) {
          chain.push({
            kind: 'REQUEST_BILL', aggregateId,
            billRequestedAt: latestBill.payload?.cancel ? null : latestBill.clientTime,
            eventIds: [latestBill.id], lane: laneOf([latestBill]),
          });
        }
        const latestStatus = collapse(statusEvents);
        if (latestStatus) {
          chain.push({ kind: 'UPDATE_STATUS', aggregateId, status: statusForEvent(latestStatus), eventIds: [latestStatus.id], lane: laneOf([latestStatus]) });
        }
        const latestPayment = collapse(paymentEvents);
        if (latestPayment) {
          chain.push({ kind: 'COLLECT_PAYMENT', aggregateId, eventIds: [latestPayment.id], lane: laneOf([latestPayment]) });
        }

        // Event types with a command but no server task yet — local-only.
        const handled = new Set([...itemEvents, ...statusEvents, ...paymentEvents, ...billEvents].map((e) => e.id));
        const leftover = events.filter((e) => !handled.has(e.id));
        if (leftover.length) markConfirmed(leftover.map((e) => e.id));
      }
    }

    if (chain.length) {
      chains.set(aggregateId, chain);
    } else {
      // INVARIANT: pending events must always produce either a task or a
      // terminal state. Anything reaching here is unshippable by construction
      // (no view-store entry to build a body from — e.g. the order was pruned,
      // or these are local-only event types for an aggregate we no longer
      // hold). Confirm them as local-only rather than leaving them QUEUED:
      // a silently-stuck queue is the failure mode this whole engine exists to
      // prevent, and it makes the pending count untrustworthy everywhere it's
      // shown (the top-bar dot, the Sync panel, shift close).
      console.warn(
        `[outbox] ${events.length} pending event(s) for ${aggType} ${aggregateId} produced no task — confirming as local-only`,
        events.map((e) => e.type),
      );
      markConfirmed(events.map((e) => e.id));
    }
  }

  return chains;
}

function statusForEvent(e: PosEvent): string {
  switch (e.type) {
    case 'ORDER_MARKED_READY': return 'READY';
    case 'ORDER_SERVED': return 'SERVED';
    case 'ORDER_CANCELLED': return 'CANCELLED';
    case 'ORDER_VOIDED': return 'VOIDED';
    case 'ORDER_WALKED_OUT': return 'WALKED_OUT';
    default: return 'PENDING';
  }
}

// ─── Body builders (shared by the batch path and the REST fallback) ───────

function buildItemOptions(item: { variationId: string | null; variationName: string | null; addOns: Array<{ id: string; name: string; price: number }> }) {
  const hasVariation = !!item.variationId;
  const hasAddOns = !!item.addOns?.length;
  if (!hasVariation && !hasAddOns) return undefined;
  return {
    variation: hasVariation ? { id: item.variationId, name: item.variationName } : undefined,
    addOns: hasAddOns ? item.addOns : undefined,
  };
}

function createOrderBody(order: any) {
  const session = getPosSession() || ({} as any);
  return {
    type: order.type,
    tableId: order.tableId,
    branchId: session.branchId,
    tenantId: session.tenantId,
    cashierId: session.userId,
    orderNumber: order.orderNumber,
    clientId: order.id,
    shiftId: order.shiftId || null,
    items: order.items.filter((it: any) => !it.voided).map((it: any) => ({
      itemId: it.itemId,
      quantity: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.qty,
      options: buildItemOptions(it),
      notes: it.note ?? undefined,
    })),
    totalAmount: order.subtotal,
    taxAmount: order.taxAmount,
    discountAmount: order.discountAmount,
    netAmount: order.netAmount,
    notes: order.notes,
    status: 'IN_KITCHEN',
  };
}

async function addItemsBody(task: OutboxTask, order: any) {
  const events = await edb.events.bulkGet(task.eventIds);
  const lineIds = new Set(events.filter(Boolean).map((e) => e!.payload.lineId));
  const items = order.items.filter((it: any) => lineIds.has(it.lineId));
  return {
    items: items.map((it: any) => ({
      itemId: it.itemId,
      quantity: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.qty,
      options: buildItemOptions(it),
      notes: it.note ?? undefined,
    })),
  };
}

function collectPaymentBody(order: any) {
  return {
    status: 'COMPLETED',
    redeemedPointsAmount: order.redeemedPointsAmount ?? undefined,
    payments: order.payments ?? [{
      method: order.paymentMethod || 'CASH',
      amount: order.netAmount,
      status: 'COMPLETED',
    }],
  };
}

// ─── Batch op builder ────────────────────────────────────────────────────

interface BatchOp {
  opId: string;
  kind: TaskKind;
  aggregateId: string;
  targetId: string | null;
  idempotencyKey?: string;
  body: any;
}

async function buildOp(task: OutboxTask): Promise<BatchOp | null> {
  const orders = useViews.getState().orders;
  const order = orders[task.aggregateId];
  const opId = task.eventIds.join(',');

  switch (task.kind) {
    case 'CREATE_ORDER':
      if (!order) return null;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, idempotencyKey: task.aggregateId, body: createOrderBody(order) };
    case 'ADD_ITEMS': {
      if (!order) return null;
      const body = await addItemsBody(task, order);
      if (!body.items.length) return null; // lines removed before shipping — nothing to add
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `additems:${opId}`, body };
    }
    case 'UPDATE_STATUS':
      if (!order) return null;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, body: { status: task.status } };
    case 'COLLECT_PAYMENT':
      if (!order) return null;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `pay:${opId}`, body: collectPaymentBody(order) };
    case 'REQUEST_BILL':
      if (!order) return null;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, body: { billRequestedAt: task.billRequestedAt ?? null } };
    case 'UPDATE_TABLE_STATUS':
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, body: { status: task.status } };
    case 'CLEAN_TABLE':
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, body: {} };
  }
}

// ─── REST fallback executors (used only if the batch endpoint 404s) ───────

async function runTaskViaRest(task: OutboxTask): Promise<void> {
  const orders = useViews.getState().orders;
  const order = orders[task.aggregateId];

  if (task.kind === 'CREATE_ORDER') {
    if (!order) return;
    const res = await fetchWithTimeout(`${API_URL}/api/orders`, { method: 'POST', headers: authHeaders(task.aggregateId), body: JSON.stringify(createOrderBody(order)) });
    if (!res.ok) throw classifyHttpError(res.status);
    const created = await res.json();
    reconcileServerId(task.aggregateId, created.id);
    return;
  }
  if (task.kind === 'UPDATE_TABLE_STATUS') {
    const res = await fetchWithTimeout(`${API_URL}/api/tables/${task.aggregateId}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: task.status }) });
    if (!res.ok) throw classifyHttpError(res.status);
    return;
  }
  if (task.kind === 'CLEAN_TABLE') {
    const res = await fetchWithTimeout(`${API_URL}/api/tables/${task.aggregateId}/clean`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw classifyHttpError(res.status);
    return;
  }

  if (!order?.serverId) throw new TaskError('No serverId yet', false);
  if (task.kind === 'ADD_ITEMS') {
    const body = await addItemsBody(task, order);
    if (!body.items.length) return;
    const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}/items`, { method: 'POST', headers: authHeaders(`additems:${task.eventIds.join(',')}`), body: JSON.stringify(body) });
    if (!res.ok) throw classifyHttpError(res.status);
    return;
  }
  const body = task.kind === 'COLLECT_PAYMENT' ? collectPaymentBody(order)
    : task.kind === 'REQUEST_BILL' ? { billRequestedAt: task.billRequestedAt ?? null }
    : { status: task.status };
  const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw classifyHttpError(res.status);
}

// ─── Event bookkeeping ───────────────────────────────────────────────────

async function markInflight(eventIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  await edb.events.where('id').anyOf(eventIds).modify({ syncState: 'INFLIGHT', lastAttemptAt: now });
  reflectOrderSyncState(eventIds, 'PENDING');
}

async function markConfirmed(eventIds: string | string[]): Promise<void> {
  const ids = Array.isArray(eventIds) ? eventIds : [eventIds];
  const now = new Date().toISOString();
  await edb.events.where('id').anyOf(ids).modify({ syncState: 'CONFIRMED', confirmedAt: now });
  reflectOrderSyncState(ids, 'SYNCED');
}

async function markSuperseded(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const now = new Date().toISOString();
  await edb.events.where('id').anyOf(eventIds).modify({ syncState: 'SUPERSEDED', confirmedAt: now });
}

async function markAbandoned(events: PosEvent[]): Promise<void> {
  const now = new Date().toISOString();
  for (const e of events) {
    await edb.events.update(e.id, { syncState: 'ABANDONED', lastAttemptAt: now, lastError: 'Exceeded 24h max lifetime' });
    reportDeadLetter({ ...e, lastError: 'Exceeded 24h max lifetime' }, e.attempts).catch(() => {});
  }
  if (events.length) reflectOrderSyncState(events.map((e) => e.id), 'POISONED');
}

async function reportDeadLetter(e: PosEvent, attempts: number): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/pos/dead-letters`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        branchId: e.branchId, terminalId: e.terminalId, eventId: e.id,
        eventType: e.type, aggregateId: e.aggregateId, aggregateType: e.aggregateType,
        payload: e.payload, attempts, lastError: e.lastError,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('[outbox] Failed to report dead letter', e.id, err);
  }
}

let authExpiredToastShownAt = 0;
function notifyAuthExpiredOnce() {
  const now = Date.now();
  if (now - authExpiredToastShownAt < 10 * 60 * 1000) return;
  authExpiredToastShownAt = now;
  toast.warning('Your session has expired — sign out and back in to sync pending changes.', { duration: 8000 });
}

async function markFailed(eventIds: string[], err: TaskError): Promise<boolean> {
  const now = new Date().toISOString();
  const events = (await edb.events.bulkGet(eventIds)).filter(Boolean) as PosEvent[];
  let anyPoisoned = false;
  if (err.authExpired) notifyAuthExpiredOnce();
  for (const e of events) {
    const attempts = e.attempts + 1;
    const poisoned = err.permanent && attempts > err.graceRetries;
    if (poisoned) anyPoisoned = true;
    await edb.events.update(e.id, {
      syncState: poisoned ? 'POISONED' : 'DEGRADED',
      attempts, lastAttemptAt: now, lastError: err.message,
    });
    if (poisoned) reportDeadLetter({ ...e, lastError: err.message }, attempts).catch(() => {});
  }
  reflectOrderSyncState(eventIds, anyPoisoned ? 'POISONED' : 'DEGRADED');
  return anyPoisoned;
}

// A dead CREATE_ORDER means every dependent event for that order can never
// ship — poison the whole aggregate so it surfaces as one dead-letter, not
// N silently stuck events.
async function cascadePoisonAggregate(aggregateId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  const rest = await edb.events
    .where('aggregateId').equals(aggregateId)
    .and((e) => NON_TERMINAL_STATES.includes(e.syncState))
    .toArray();
  for (const e of rest) {
    await edb.events.update(e.id, { syncState: 'POISONED', lastAttemptAt: now, lastError: reason });
    reportDeadLetter({ ...e, lastError: reason }, e.attempts).catch(() => {});
  }
  if (rest.length) reflectOrderSyncState(rest.map((e) => e.id), 'POISONED');
}

function reflectOrderSyncState(eventIds: string[], state: 'SYNCED' | 'PENDING' | 'DEGRADED' | 'POISONED'): void {
  const orders = useViews.getState().orders;
  edb.events.bulkGet(eventIds).then((events) => {
    const patch: Record<string, any> = {};
    for (const e of events) {
      if (!e || e.aggregateType !== 'ORDER') continue;
      const o = orders[e.aggregateId];
      if (o && o.syncState !== 'SYNCED') patch[e.aggregateId] = { ...o, syncState: state };
    }
    if (Object.keys(patch).length) {
      useViews.getState()._setSnapshot({ orders: { ...useViews.getState().orders, ...patch } });
    }
  }).catch(() => {});
}

// ─── Circuit breaker ─────────────────────────────────────────────────────

function tripCircuit(): void {
  if (circuitOpen) return;
  circuitOpen = true;
  consecutiveProbeSuccesses = 0;
  if (probeHandle) clearInterval(probeHandle);
  probeHandle = setInterval(probeHealth, CIRCUIT_PROBE_INTERVAL_MS);
  console.warn('[outbox] circuit breaker OPEN — probing /health every 15s');
}

async function probeHealth(): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/health`, { method: 'HEAD' }, 2000);
    if (res.ok) {
      consecutiveProbeSuccesses++;
      if (consecutiveProbeSuccesses >= CIRCUIT_CLOSE_THRESHOLD) {
        circuitOpen = false;
        consecutiveFailures = 0;
        consecutiveProbeSuccesses = 0;
        if (probeHandle) { clearInterval(probeHandle); probeHandle = null; }
        console.info('[outbox] circuit breaker CLOSED — resuming');
        kickOutbox('immediate');
      }
    } else {
      consecutiveProbeSuccesses = 0;
    }
  } catch {
    consecutiveProbeSuccesses = 0;
  }
}

export function getCircuitState(): 'CLOSED' | 'OPEN' {
  return circuitOpen ? 'OPEN' : 'CLOSED';
}

// ─── Shipping ────────────────────────────────────────────────────────────

function noteFailure(te: TaskError): void {
  if (!te.permanent && !te.authExpired) {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_TRIP_THRESHOLD) tripCircuit();
  }
}

// CRITICAL tasks ship one per request, immediately, with a short retry
// schedule of their own — a payment must not wait behind anything.
async function runCriticalTask(task: OutboxTask): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    if (circuitOpen) return;
    await markInflight(task.eventIds);
    try {
      if (batchEndpointAvailable) {
        const op = await buildOp(task);
        if (!op) { await markConfirmed(task.eventIds); return; }
        await shipOps([op], [task]);
      } else {
        await runTaskViaRest(task);
        await markConfirmed(task.eventIds);
      }
      consecutiveFailures = 0;
      return;
    } catch (err) {
      const te = err instanceof TaskError ? err : new TaskError((err as Error)?.message ?? 'Unknown error', false);
      const poisoned = await markFailed(task.eventIds, te);
      noteFailure(te);
      if (poisoned && task.kind === 'CREATE_ORDER') {
        await cascadePoisonAggregate(task.aggregateId, 'Order create rejected by the server');
      }
      if (poisoned || te.authExpired || attempt >= CRITICAL_RETRY_MS.length - 1) return;
      await new Promise((r) => setTimeout(r, CRITICAL_RETRY_MS[attempt]));
    }
  }
}

// Ship a set of ops as ONE batch request; apply each per-op result to its
// task's events independently (partial success is normal).
async function shipOps(ops: BatchOp[], tasks: OutboxTask[]): Promise<void> {
  const byOpId = new Map(tasks.map((t) => [t.eventIds.join(','), t]));
  for (const t of tasks) await markInflight(t.eventIds);
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}/api/pos/events/batch`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ terminalId: getPosSession()?.userId, ops }),
    });
  } catch (err) {
    // network/timeout — every task in the batch degrades and retries
    const te = err instanceof TaskError ? err : new TaskError((err as Error)?.message ?? 'Batch request failed', false);
    for (const t of tasks) await markFailed(t.eventIds, te);
    noteFailure(te);
    throw te;
  }
  recordRtt(performance.now() - t0);

  if (res.status === 404) {
    batchEndpointAvailable = false;
    console.warn('[outbox] /api/pos/events/batch not available — falling back to REST');
    for (const t of tasks) await edb.events.where('id').anyOf(t.eventIds).modify({ syncState: 'QUEUED' });
    return;
  }
  if (!res.ok) {
    const te = classifyHttpError(res.status);
    for (const t of tasks) await markFailed(t.eventIds, te);
    noteFailure(te);
    throw te;
  }

  const { results } = (await res.json()) as { results: Array<{ opId: string; ok: boolean; status: number; body?: any; error?: string; permanent?: boolean }> };
  consecutiveFailures = 0;

  // Two passes so a CREATE_ORDER failure's cascade runs before we'd otherwise
  // touch its dependents' state. A 424 "skipped — earlier op failed" is left
  // QUEUED (it'll ship next cycle once the create lands) unless the create
  // itself poisoned, in which case the cascade already poisoned it too.
  const failedAggs = new Set<string>();
  for (const r of results) {
    const task = byOpId.get(r.opId);
    if (!task) continue;
    if (r.ok) {
      if (task.kind === 'CREATE_ORDER' && r.body?.id) reconcileServerId(task.aggregateId, r.body.id);
      await markConfirmed(task.eventIds);
    } else if (r.status === 424) {
      // "skipped — earlier op failed" — put it back to QUEUED for next cycle.
      failedAggs.add(task.aggregateId);
      await edb.events.where('id').anyOf(task.eventIds).modify({ syncState: 'QUEUED' });
    } else {
      const te = new TaskError(r.error ?? `HTTP ${r.status}`, !!r.permanent, {
        authExpired: r.status === 401,
        graceRetries: r.status === 409 ? 1 : 0,
      });
      const poisoned = await markFailed(task.eventIds, te);
      failedAggs.add(task.aggregateId);
      if (poisoned && task.kind === 'CREATE_ORDER') {
        await cascadePoisonAggregate(task.aggregateId, 'Order create rejected by the server');
      }
    }
  }
}

// ─── Drain ───────────────────────────────────────────────────────────────

async function drain(): Promise<void> {
  if (draining || circuitOpen) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  draining = true;
  try {
    const chains = await deriveTaskChains();
    if (chains.size === 0) return;

    // Flatten: one aggregate's whole chain stays together and in order, so
    // per-aggregate serial ordering is preserved whichever lane it lands in.
    type Bundle = { aggregateId: string; tasks: OutboxTask[]; lane: SyncLane };
    const bundles: Bundle[] = Array.from(chains.entries()).map(([aggregateId, tasks]) => ({
      aggregateId,
      tasks,
      lane: bundleLane(tasks),
    }));

    const lanes: SyncLane[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];
    const tier = currentTier();

    for (const lane of lanes) {
      if (circuitOpen) break;
      const laneBundles = bundles.filter((b) => b.lane === lane);
      if (laneBundles.length === 0) continue;

      if (lane === 'CRITICAL') {
        // Own request each, immediate, sequential (payments must not race).
        for (const b of laneBundles) {
          for (const task of b.tasks) {
            if (circuitOpen) break;
            await runCriticalTask(task);
          }
        }
        continue;
      }

      // Pack bundles into batches of <= tier.batchSize ops, ship <= tier.concurrency
      // at once. A single aggregate's whole chain is NEVER split across two
      // batches — otherwise its ADD_ITEMS and UPDATE_STATUS could ship in
      // parallel batches and land out of order server-side.
      const batches: Array<{ ops: BatchOp[]; tasks: OutboxTask[] }> = [];
      let curOps: BatchOp[] = [];
      let curTasks: OutboxTask[] = [];
      for (const b of laneBundles) {
        const bundleOps: BatchOp[] = [];
        const bundleTasks: OutboxTask[] = [];
        for (const task of b.tasks) {
          const op = await buildOp(task);
          if (!op) { await markConfirmed(task.eventIds); continue; }
          bundleOps.push(op);
          bundleTasks.push(task);
        }
        if (bundleOps.length === 0) continue;
        if (curOps.length > 0 && curOps.length + bundleOps.length > tier.batchSize) {
          batches.push({ ops: curOps, tasks: curTasks });
          curOps = [];
          curTasks = [];
        }
        curOps.push(...bundleOps);
        curTasks.push(...bundleTasks);
        if (curOps.length >= tier.batchSize) { batches.push({ ops: curOps, tasks: curTasks }); curOps = []; curTasks = []; }
      }
      if (curOps.length) batches.push({ ops: curOps, tasks: curTasks });

      for (let i = 0; i < batches.length; i += tier.concurrency) {
        if (circuitOpen) break;
        const slice = batches.slice(i, i + tier.concurrency);
        await Promise.all(slice.map((b) =>
          (batchEndpointAvailable
            ? shipOps(b.ops, b.tasks)
            : shipBundleViaRest(b.tasks)
          ).catch(() => { /* per-task state already recorded */ }),
        ));
      }
    }
  } finally {
    draining = false;
  }
  // Spec Part 6 — if a shift was closed with events still queued and the
  // queue is now empty, tell the server to finalise it (PENDING_SYNC → CLOSED).
  await finalisePendingSyncShiftIfDrained().catch(() => {});
}

function bundleLane(tasks: OutboxTask[]): SyncLane {
  const ranks: SyncLane[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];
  let best = 3;
  for (const t of tasks) best = Math.min(best, ranks.indexOf(t.lane));
  return ranks[best];
}

async function shipBundleViaRest(tasks: OutboxTask[]): Promise<void> {
  for (const task of tasks) {
    if (circuitOpen) return;
    await markInflight(task.eventIds);
    try {
      await runTaskViaRest(task);
      await markConfirmed(task.eventIds);
      consecutiveFailures = 0;
    } catch (err) {
      const te = err instanceof TaskError ? err : new TaskError((err as Error)?.message ?? 'Unknown error', false);
      const poisoned = await markFailed(task.eventIds, te);
      noteFailure(te);
      if (poisoned && task.kind === 'CREATE_ORDER') {
        await cascadePoisonAggregate(task.aggregateId, 'Order create rejected by the server');
      }
      return; // stop this aggregate's chain on first failure
    }
  }
}

// ─── Watchdog / re-eval / stall detector ─────────────────────────────────

async function runWatchdog(): Promise<void> {
  const now = Date.now();

  // 24h max lifetime → ABANDONED + dead-letter.
  const nonTerminal = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).toArray();
  const maxLifetimeMs = syncCfg().maxLifetimeMs;
  const stale = nonTerminal.filter((e) => now - new Date(e.clientTime).getTime() > maxLifetimeMs);
  if (stale.length) {
    console.error(`[outbox] watchdog: ${stale.length} event(s) exceeded 24h — ABANDONED`);
    await markAbandoned(stale);
  }

  // A request that somehow never settled — INFLIGHT far longer than the 8s
  // timeout allows. Requeue so it retries instead of hanging forever.
  const stuckInflight = nonTerminal.filter(
    (e) => e.syncState === 'INFLIGHT' && e.lastAttemptAt && now - new Date(e.lastAttemptAt).getTime() > 90_000,
  );
  if (stuckInflight.length) {
    console.warn(`[outbox] watchdog: requeueing ${stuckInflight.length} stuck INFLIGHT event(s)`);
    await edb.events.where('id').anyOf(stuckInflight.map((e) => e.id)).modify({ syncState: 'DEGRADED' });
    kickOutbox('immediate');
  }
}

// A BLOCKED/QUEUED/DEGRADED event whose dependency is POISONED or ABANDONED
// can never ship — poison it too rather than leave it waiting forever.
async function runBlockedReeval(): Promise<void> {
  const pending = await edb.events.where('syncState').anyOf(['BLOCKED', 'QUEUED', 'DEGRADED']).toArray();
  const withDeps = pending.filter((e) => e.dependsOn && e.dependsOn.length > 0);
  if (withDeps.length === 0) return;

  const now = new Date().toISOString();
  let killed = 0;
  for (const e of withDeps) {
    const deps = (await edb.events.bulkGet(e.dependsOn)).filter(Boolean) as PosEvent[];
    const deadDep = deps.find((d) => d.syncState === 'POISONED' || d.syncState === 'ABANDONED');
    if (deadDep) {
      await edb.events.update(e.id, { syncState: 'POISONED', lastAttemptAt: now, lastError: `Dependency ${deadDep.id} is ${deadDep.syncState}` });
      reportDeadLetter({ ...e, lastError: `Dependency ${deadDep.id} is ${deadDep.syncState}` }, e.attempts).catch(() => {});
      reflectOrderSyncState([e.id], 'POISONED');
      killed++;
    }
  }
  if (killed) console.warn(`[outbox] blocked re-eval: poisoned ${killed} dependent(s) of a dead event`);
}

async function runStallCheck(): Promise<void> {
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const count = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).count();

  if (count === 0 || !online || circuitOpen) {
    lastNonTerminalCount = count;
    lastProgressAt = Date.now();
    return;
  }
  if (lastNonTerminalCount === -1 || count < lastNonTerminalCount) {
    lastProgressAt = Date.now(); // made progress
  }
  lastNonTerminalCount = count;

  if (Date.now() - lastProgressAt > STALL_RESTART_AFTER_MS) {
    console.error(`[outbox] STALL DETECTED — ${count} non-terminal events, no progress for 3min, network up. Restarting sync engine.`);
    restartEngine();
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────

function clearAllHandles(): void {
  for (const h of handles) clearInterval(h);
  handles = [];
  if (probeHandle) { clearInterval(probeHandle); probeHandle = null; }
  if (kickScheduled) { clearTimeout(kickScheduled); kickScheduled = null; }
}

function restartEngine(): void {
  clearAllHandles();
  draining = false;
  circuitOpen = false;
  consecutiveFailures = 0;
  consecutiveProbeSuccesses = 0;
  batchEndpointAvailable = true;
  rttSamples.length = 0;
  lastNonTerminalCount = -1;
  lastProgressAt = Date.now();
  startLoops();
  kickOutbox('immediate');
}

export function kickOutbox(mode?: 'immediate'): void {
  if (kickScheduled) {
    if (mode !== 'immediate') return;
    clearTimeout(kickScheduled);
    kickScheduled = null;
  }
  const delay = mode === 'immediate' ? 0 : 200; // spec: coalesce ~200ms, ship a HIGH/CRITICAL burst now
  kickScheduled = setTimeout(() => {
    kickScheduled = null;
    drain().catch(console.error);
  }, delay);
}

function startLoops(): void {
  handles.push(setInterval(() => kickOutbox(), 5000));
  handles.push(setInterval(() => runWatchdog().catch(console.error), WATCHDOG_INTERVAL_MS));
  handles.push(setInterval(() => runBlockedReeval().catch(console.error), BLOCKED_REEVAL_INTERVAL_MS));
  handles.push(setInterval(() => runStallCheck().catch(console.error), STALL_SAMPLE_INTERVAL_MS));
}

export function startOutbox(): () => void {
  if (started) return () => {};
  started = true;

  lastProgressAt = Date.now();
  startLoops();
  kickOutbox('immediate');
  runWatchdog().catch(console.error); // catch anything left dead from a previous session

  const handleOnline = () => kickOutbox('immediate');
  window.addEventListener('online', handleOnline);

  return () => {
    clearAllHandles();
    window.removeEventListener('online', handleOnline);
    started = false;
  };
}

// ─── Status for UI (sign-out guard, offline badges, Sync Status panel) ────

export async function hasUnsyncedEvents(): Promise<boolean> {
  const count = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).count();
  return count > 0;
}

export interface UnsyncedSummary {
  count: number;
  poisoned: number;
  abandoned: number;
  superseded: number;
  confirmedToday: number;
  oldestAt: string | null;
  authExpiredCount: number;
  blockedOnAuthOnly: boolean;
  circuitOpen: boolean;
  stalled: boolean;
  avgRttMs: number | null;
}

export async function getUnsyncedSummary(): Promise<UnsyncedSummary> {
  const pending = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).toArray();
  const [poisoned, abandoned, superseded] = await Promise.all([
    edb.events.where('syncState').equals('POISONED').count(),
    edb.events.where('syncState').equals('ABANDONED').count(),
    edb.events.where('syncState').equals('SUPERSEDED').count(),
  ]);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const confirmedToday = await edb.events.where('syncState').equals('CONFIRMED').and((e) => (e.confirmedAt ?? '') >= since).count();

  pending.sort((a, b) => a.seq - b.seq);
  const authExpiredCount = pending.filter((e) => e.lastError === AUTH_EXPIRED_ERROR).length;
  const avg = rttSamples.length ? Math.round(rttSamples.reduce((s, n) => s + n, 0) / rttSamples.length) : null;

  return {
    count: pending.length,
    poisoned, abandoned, superseded, confirmedToday,
    oldestAt: pending[0]?.clientTime ?? null,
    authExpiredCount,
    blockedOnAuthOnly: pending.length > 0 && authExpiredCount === pending.length,
    circuitOpen,
    stalled: pending.length > 0 && Date.now() - lastProgressAt > STALL_RESTART_AFTER_MS,
    avgRttMs: avg,
  };
}

/** Full diagnostic dump for the Sync Status panel / Export Diagnostics. */
export async function getSyncDiagnostics() {
  const all = await edb.events.toArray();
  const byState: Record<string, number> = {};
  for (const e of all) byState[e.syncState] = (byState[e.syncState] ?? 0) + 1;
  const attention = all
    .filter((e) => e.syncState === 'POISONED' || e.syncState === 'ABANDONED')
    .map((e) => ({ id: e.id, type: e.type, aggregateId: e.aggregateId, state: e.syncState, attempts: e.attempts, lastError: e.lastError, at: e.lastAttemptAt }));
  return {
    byState,
    circuitOpen,
    batchEndpointAvailable,
    avgRttMs: rttSamples.length ? Math.round(rttSamples.reduce((s, n) => s + n, 0) / rttSamples.length) : null,
    lastProgressAt: new Date(lastProgressAt).toISOString(),
    attention,
  };
}

/** Manual "Force Sync Now" from the Sync Status panel. */
export function forceSyncNow(): void {
  consecutiveFailures = 0;
  circuitOpen = false;
  kickOutbox('immediate');
}

/**
 * Operator-initiated discard of a POISONED / ABANDONED event that can never
 * succeed on retry (a stale PKR 0 payment the server keeps rejecting, an
 * event whose order was cancelled server-side, …). Marks it SUPERSEDED —
 * terminal, and out of the "needs a manager" count — without shipping
 * anything, and clears the sync flag on its order so the board stops showing
 * it as stuck. Retrying such an event just re-poisons it; this is the way out.
 */
export async function discardStuckEvent(eventId: string): Promise<void> {
  const e = await edb.events.get(eventId);
  if (!e || (e.syncState !== 'POISONED' && e.syncState !== 'ABANDONED')) return;
  await edb.events.update(eventId, {
    syncState: 'SUPERSEDED',
    confirmedAt: new Date().toISOString(),
    lastError: `Discarded by operator${e.lastError ? ` — was: ${e.lastError}` : ''}`,
  });
  reflectOrderSyncState([eventId], 'SYNCED');

  // Undo the discarded event's effect on the board. A rejected PAYMENT_COLLECTED
  // still marked its order COMPLETED locally (the reducer applies it optimistically),
  // so the order vanished from Tickets while the server kept it unpaid — and every
  // close-shift attempt then blocked on an order the cashier couldn't see. Replay
  // without the now-SUPERSEDED event, then re-pull the live list so the order
  // reappears at its real server status.
  try {
    const { rebuildViews, refreshOrders } = await import('./views');
    await rebuildViews();
    const { getPosSession, getPosShift } = await import('@/lib/pos-session');
    const branchId = getPosSession()?.branchId;
    if (branchId) {
      const role = getPosSession()?.role;
      const isManager = role === 'BRANCH_MANAGER' || role === 'TENANT_ADMIN';
      await refreshOrders(branchId, isManager ? {} : { shiftId: getPosShift()?.shiftId ?? null });
    }
  } catch { /* the SUPERSEDED mark is what matters; the board refreshes on its own cadence too */ }
}

// ─── Shift close (spec Part 6) ───────────────────────────────────────────

const PAYMENT_TYPES = new Set(['PAYMENT_COLLECTED']);
const ORDER_TYPES = new Set([
  'ORDER_CREATED', 'ORDER_SENT_TO_KITCHEN', 'ORDER_MARKED_READY', 'ORDER_SERVED',
  'ORDER_CANCELLED', 'ORDER_VOIDED', 'ORDER_WALKED_OUT', 'ITEM_ADDED', 'ITEM_REMOVED',
  'ITEM_VOIDED', 'ITEM_QTY_CHANGED',
]);

export interface SyncCategoryProgress {
  payments: number; // non-terminal events still pending, by category
  orders: number;
  other: number;
  total: number;
}

/** Remaining non-terminal events grouped for the close-shift progress modal. */
export async function getSyncCategoryProgress(): Promise<SyncCategoryProgress> {
  const pending = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).toArray();
  let payments = 0, orders = 0, other = 0;
  for (const e of pending) {
    if (PAYMENT_TYPES.has(e.type)) payments++;
    else if (ORDER_TYPES.has(e.type)) orders++;
    else other++;
  }
  return { payments, orders, other, total: pending.length };
}

// Set by the POS when a shift is closed with events still queued. When the
// outbox next drains to zero — this session or a later one — it POSTs
// sync-complete so the server flips the shift PENDING_SYNC → CLOSED.
const PENDING_SYNC_SHIFT_KEY = 'pos_pending_sync_shift';
// Set only when the close POST itself never reached the server (offline / 5xx).
// The shift is closed on the terminal but still OPEN server-side, so the close
// has to be replayed before sync-complete can mean anything.
const PENDING_SHIFT_CLOSE_KEY = 'pos_pending_shift_close';

export function markShiftPendingSync(shiftId: string, unsentClosePayload?: unknown): void {
  try {
    localStorage.setItem(PENDING_SYNC_SHIFT_KEY, shiftId);
    if (unsentClosePayload !== undefined) {
      localStorage.setItem(PENDING_SHIFT_CLOSE_KEY, JSON.stringify(unsentClosePayload));
    }
  } catch { /* ignore */ }
}

/** Replay a close POST that never landed. Returns false if it still hasn't. */
async function replayPendingShiftClose(shiftId: string): Promise<boolean> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PENDING_SHIFT_CLOSE_KEY); } catch { /* ignore */ }
  if (!raw) return true; // nothing outstanding — the close already landed

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/shifts/${shiftId}/close`, {
      method: 'POST',
      headers: authHeaders(),
      body: raw,
    });
    // 4xx here means the server already has it closed, or is refusing for a
    // reason replaying won't fix — either way stop retrying forever.
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      try { localStorage.removeItem(PENDING_SHIFT_CLOSE_KEY); } catch { /* ignore */ }
      return true;
    }
  } catch { /* still offline */ }
  return false;
}

async function finalisePendingSyncShiftIfDrained(): Promise<void> {
  let shiftId: string | null = null;
  try { shiftId = localStorage.getItem(PENDING_SYNC_SHIFT_KEY); } catch { /* ignore */ }
  if (!shiftId) return;

  const remaining = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).count();
  if (remaining > 0) return;

  // The close itself may never have reached the server (closed offline).
  // Replay it first — sync-complete is meaningless on a shift the server
  // still thinks is OPEN.
  if (!(await replayPendingShiftClose(shiftId))) return;

  const poisonedOrAbandoned = await edb.events.where('syncState').anyOf(['POISONED', 'ABANDONED']).count();
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/shifts/${shiftId}/sync-complete`, {
      method: 'POST',
      headers: authHeaders(),
      // Nothing more to send — the server recomputes from the DB, which now
      // has every one of this shift's orders/payments.
      body: JSON.stringify({}),
    });
    if (res.ok || res.status === 400 /* already closed / not pending */) {
      try { localStorage.removeItem(PENDING_SYNC_SHIFT_KEY); } catch { /* ignore */ }
      if (poisonedOrAbandoned === 0) {
        try {
          const { toast } = await import('sonner');
          toast.success('Your closed shift finished syncing.');
        } catch { /* ignore */ }
      }
    }
  } catch { /* offline — try again on the next drain */ }
}
