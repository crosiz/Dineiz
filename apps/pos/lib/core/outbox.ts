import { edb, type PosEvent } from './event-log';
import { useViews, reconcileServerId } from './views';
import { getToken, getPosSession } from '@/lib/pos-session';

// ─── The outbox: ships confirmed local events to the server ────────────────
//
// The spec asked for a dependency-graph outbox that ships individual events.
// The real constraint this has to work against: the server has no event
// ingestion endpoint (that's Phase 4, explicitly deferred) — every existing
// endpoint (`POST /api/orders`, `PUT /api/orders/:id`,
// `POST /api/orders/:id/items`, `PUT /api/tables/:id/status`) is
// snapshot-shaped, not delta-shaped. Shipping raw events to it one at a time
// would mean inventing a fake per-event contract today and throwing it away
// once Phase 4's real endpoint exists.
//
// So this outbox collapses queued events per aggregate into a small set of
// *tasks* that match the server's actual shape (create-order, add-items,
// update-status, collect-payment, update-table-status), while still using
// the event log as the durable source of truth and retry ledger — each
// event's syncState/attempts/lastError is what drives backoff, and a task
// only resolves once every event it covers is marked CONFIRMED. This is the
// same outbox this app needs today, and it's a straight swap-in once Phase 4
// adds a real ingestion endpoint: only deriveTasks()'s HTTP calls change.
//
// It also absorbs the ad-hoc "fetch, then queue-offline-on-failure" logic
// that used to be duplicated in order/page.tsx, PaymentModal.tsx,
// TicketsDashboard.tsx, OrderDetailsModal.tsx, and ClientTableMap.tsx — each
// of those now just calls a command and lets this drain loop ship it.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 6000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];
const DEGRADED_RETRY_MS = 60000;
const MAX_CONCURRENT_AGGREGATES = 4;
const CIRCUIT_TRIP_THRESHOLD = 3;
const CIRCUIT_PROBE_INTERVAL_MS = 15000;
const CIRCUIT_CLOSE_THRESHOLD = 2;

type TaskKind = 'CREATE_ORDER' | 'ADD_ITEMS' | 'UPDATE_STATUS' | 'COLLECT_PAYMENT' | 'UPDATE_TABLE_STATUS';

interface OutboxTask {
  kind: TaskKind;
  aggregateId: string;
  eventIds: string[];
  status?: string; // UPDATE_STATUS / UPDATE_TABLE_STATUS
}

// ─── Module state ────────────────────────────────────────────────────────

let draining = false;
let kickScheduled = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;

let circuitOpen = false;
let consecutiveFailures = 0;
let consecutiveProbeSuccesses = 0;
let probeHandle: ReturnType<typeof setInterval> | null = null;

function authHeaders(idempotencyKey?: string): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
  constructor(message: string, permanent: boolean) {
    super(message);
    this.permanent = permanent;
  }
}

function classifyHttpError(status: number): TaskError {
  if (status === 401 || status === 403 || status === 408 || status === 429 || status >= 500) {
    return new TaskError(`HTTP ${status}`, false);
  }
  return new TaskError(`HTTP ${status}`, true);
}

// ─── Task derivation — collapses queued/degraded events per aggregate ──────

function delayForAttempts(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts > BACKOFF_MS.length) return DEGRADED_RETRY_MS;
  return BACKOFF_MS[attempts - 1];
}

function isDue(e: PosEvent, now: number): boolean {
  // BLOCKED means "depends on an earlier event for the same aggregate"
  // (event-log.ts's append() sets this on every event after the first per
  // aggregate) — not a failure state. It's immediately due here because
  // deriveTaskChains() already gives it that ordering guarantee itself: it
  // sorts every aggregate's candidates by seq and collapses them into one
  // serial per-aggregate chain, so a same-aggregate predecessor is always
  // shipped first regardless of which syncState either one carries.
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

  for (const [aggregateId, events] of Array.from(byAggregate)) {
    const aggType = events[0].aggregateType;
    const chain: OutboxTask[] = [];

    if (aggType === 'TABLE') {
      const statusEvents = events.filter((e) => e.type === 'TABLE_STATUS_CHANGED');
      if (statusEvents.length) {
        const latest = statusEvents[statusEvents.length - 1];
        chain.push({
          kind: 'UPDATE_TABLE_STATUS',
          aggregateId,
          status: latest.payload.status,
          eventIds: statusEvents.map((e) => e.id),
        });
      }
      // TABLE_MERGED / TABLE_SPLIT have a command in commands.ts but no
      // server endpoint or task type yet (there's no /api/tables/merge or
      // /split route to ship them to). Left QUEUED they'd sit forever with
      // no retry and no path to POISONED, permanently blocking
      // hasUnsyncedEvents() the moment a screen starts calling them — same
      // failure mode the ORDER branch below already guards against for its
      // own not-yet-wired event types. Confirm them as local-only instead.
      const handledTable = new Set(statusEvents.map((e) => e.id));
      const leftoverTable = events.filter((e) => !handledTable.has(e.id));
      if (leftoverTable.length) markConfirmed(leftoverTable.map((e) => e.id));
    } else if (aggType === 'SHIFT') {
      // Shift-lifecycle events (open/close/break/cash) already ship
      // synchronously from their own call sites (shift-open flow, break
      // start/end, cash drawer, close-shift modal) and get an immediate
      // server response there — they're recorded here only for the local
      // audit trail, not re-shipped by this loop. Mark them confirmed so
      // they don't sit QUEUED forever and look like a stuck sync.
      for (const e of events) markConfirmed(e.id);
    } else {
      // ORDER
      const order = orders[aggregateId];
      const hasServerId = !!order?.serverId;
      const sentEvent = events.find((e) => e.type === 'ORDER_SENT_TO_KITCHEN');

      if (sentEvent && !hasServerId) {
        // First ship for this order — bundle every other queued event too,
        // since CREATE_ORDER ships the full current view snapshot and so
        // covers them all in one request.
        chain.push({ kind: 'CREATE_ORDER', aggregateId, eventIds: events.map((e) => e.id) });
      } else if (hasServerId) {
        const itemEvents = events.filter((e) => e.type === 'ITEM_ADDED');
        const statusEvents = events.filter((e) =>
          ['ORDER_MARKED_READY', 'ORDER_SERVED', 'ORDER_CANCELLED', 'ORDER_VOIDED', 'ORDER_WALKED_OUT'].includes(e.type)
        );
        const paymentEvents = events.filter((e) => e.type === 'PAYMENT_COLLECTED');

        // Serial within the aggregate, in an order that matches reality:
        // new items need to reach the kitchen before a status flip, and a
        // payment implies the order is already in its final state.
        if (itemEvents.length) {
          chain.push({ kind: 'ADD_ITEMS', aggregateId, eventIds: itemEvents.map((e) => e.id) });
        }
        if (statusEvents.length) {
          const latest = statusEvents[statusEvents.length - 1];
          chain.push({
            kind: 'UPDATE_STATUS',
            aggregateId,
            status: statusForEvent(latest),
            eventIds: statusEvents.map((e) => e.id),
          });
        }
        if (paymentEvents.length) {
          chain.push({ kind: 'COLLECT_PAYMENT', aggregateId, eventIds: paymentEvents.map((e) => e.id) });
        }

        // Event types with a command in commands.ts but no screen wired to
        // call them yet (waiter assignment, table moves, notes, discount
        // removal, print/void audit marks, manager approvals...) — and so
        // no task type here to ship them either. Left QUEUED they'd sit
        // forever and permanently block hasUnsyncedEvents() (the sign-out
        // guard) for an order that will never actually finish "syncing".
        // Confirm them as local-only rather than let a future command that
        // starts using one of these event types silently wedge sign-out.
        const handled = new Set([...itemEvents, ...statusEvents, ...paymentEvents].map((e) => e.id));
        const leftover = events.filter((e) => !handled.has(e.id));
        if (leftover.length) markConfirmed(leftover.map((e) => e.id));
      }
      // else: order not yet sent to kitchen and no send event queued —
      // purely local cart mutations, nothing to ship yet (same as today).
    }

    if (chain.length) chains.set(aggregateId, chain);
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

// ─── Task execution ──────────────────────────────────────────────────────

function buildItemOptions(item: { variationId: string | null; variationName: string | null; addOns: Array<{ id: string; name: string; price: number }> }) {
  const hasVariation = !!item.variationId;
  const hasAddOns = !!item.addOns?.length;
  if (!hasVariation && !hasAddOns) return undefined;
  return {
    variation: hasVariation ? { id: item.variationId, name: item.variationName } : undefined,
    addOns: hasAddOns ? item.addOns : undefined,
  };
}

async function runCreateOrder(task: OutboxTask): Promise<void> {
  const order = useViews.getState().orders[task.aggregateId];
  if (!order) return; // order gone locally (shouldn't happen) — nothing to ship
  const session = getPosSession() || ({} as any);

  const body = JSON.stringify({
    type: order.type,
    tableId: order.tableId,
    branchId: session.branchId,
    tenantId: session.tenantId,
    cashierId: session.userId,
    // The shift captured on the ORDER at creation time (event-log.ts's
    // append() stamps it from localStorage the instant ORDER_CREATED
    // fires) — not whatever shift happens to be active in localStorage
    // right now. If shipping is delayed past a break/shift changeover,
    // reading the live shift here would misattribute the order to the
    // wrong shift, breaking shift-scoped revenue reporting.
    shiftId: order.shiftId || null,
    items: order.items.filter((it) => !it.voided).map((it) => ({
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
  });

  // task.aggregateId is this order's permanent client id (lib/core/
  // event-log.ts's nextOrderNumber) — stable across every retry of this
  // exact CREATE_ORDER task, so the server can tell "the last attempt
  // timed out client-side but actually landed" from "this genuinely never
  // arrived" (apps/api/src/lib/idempotency.ts).
  const res = await fetchWithTimeout(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: authHeaders(task.aggregateId),
    body,
  });
  if (!res.ok) throw classifyHttpError(res.status);
  const created = await res.json();
  reconcileServerId(task.aggregateId, created.id);
}

async function runAddItems(task: OutboxTask): Promise<void> {
  const order = useViews.getState().orders[task.aggregateId];
  if (!order?.serverId) throw new TaskError('No serverId yet', false); // retry after CREATE_ORDER lands

  const events = await edb.events.bulkGet(task.eventIds);
  const lineIds = new Set(events.filter(Boolean).map((e) => e!.payload.lineId));
  const items = order.items.filter((it) => lineIds.has(it.lineId));
  if (!items.length) return; // lines were removed/voided locally before shipping — nothing left to add

  const body = JSON.stringify({
    items: items.map((it) => ({
      itemId: it.itemId,
      quantity: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.qty,
      options: buildItemOptions(it),
      notes: it.note ?? undefined,
    })),
  });

  // eventIds are seq-ordered by deriveTaskChains and stable across retries
  // of this same task, so joining them is a stable, unique-enough key for
  // this exact "add these specific lines" request.
  const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}/items`, {
    method: 'POST',
    headers: authHeaders(`additems:${task.eventIds.join(',')}`),
    body,
  });
  if (!res.ok) throw classifyHttpError(res.status);
}

async function runUpdateStatus(task: OutboxTask): Promise<void> {
  const order = useViews.getState().orders[task.aggregateId];
  if (!order?.serverId) throw new TaskError('No serverId yet', false);

  const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: task.status }),
  });
  if (!res.ok) throw classifyHttpError(res.status);
}

async function runCollectPayment(task: OutboxTask): Promise<void> {
  const order = useViews.getState().orders[task.aggregateId];
  if (!order?.serverId) throw new TaskError('No serverId yet', false);

  const body = JSON.stringify({
    status: 'COMPLETED',
    redeemedPointsAmount: order.redeemedPointsAmount ?? undefined,
    // A SPLIT checkout records its own per-method breakdown on the order
    // (commands.collectPayment's `payments` param) — ship that verbatim;
    // otherwise derive the single line from the order's own totals.
    payments: order.payments ?? [{
      method: order.paymentMethod || 'CASH',
      amount: order.netAmount,
      status: 'COMPLETED',
    }],
  });

  const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body,
  });
  if (!res.ok) throw classifyHttpError(res.status);

  // Best-effort — the table's authoritative free/dirty transition is a
  // separate TABLE_STATUS_CHANGED event/task; this just flags it for
  // bussing sooner, matching what PaymentModal did inline before.
  if (order.tableId) {
    fetchWithTimeout(`${API_URL}/api/tables/${order.tableId}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'dirty' }),
    }).catch(() => {});
  }
}

async function runUpdateTableStatus(task: OutboxTask): Promise<void> {
  const res = await fetchWithTimeout(`${API_URL}/api/tables/${task.aggregateId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status: task.status }),
  });
  if (!res.ok) throw classifyHttpError(res.status);
}

async function runTask(task: OutboxTask): Promise<void> {
  switch (task.kind) {
    case 'CREATE_ORDER': return runCreateOrder(task);
    case 'ADD_ITEMS': return runAddItems(task);
    case 'UPDATE_STATUS': return runUpdateStatus(task);
    case 'COLLECT_PAYMENT': return runCollectPayment(task);
    case 'UPDATE_TABLE_STATUS': return runUpdateTableStatus(task);
  }
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

// Phase 6: tells the server about a POISONED event so an admin dashboard
// can see it without inspecting this terminal's own IndexedDB. Best-effort
// — if this report itself can't reach the server, the event is still
// POISONED locally either way, and the next drain pass (or a future
// terminal restart) will try reporting it again since it stays POISONED
// (never re-queued) and reportDeadLetter is called fresh each time an
// event newly enters that state.
async function reportDeadLetter(e: PosEvent, attempts: number): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/pos/dead-letters`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        branchId: e.branchId,
        terminalId: e.terminalId,
        eventId: e.id,
        eventType: e.type,
        aggregateId: e.aggregateId,
        aggregateType: e.aggregateType,
        payload: e.payload,
        attempts,
        lastError: e.lastError,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('[outbox] Failed to report dead letter', e.id, err);
  }
}

async function markFailed(eventIds: string[], err: TaskError): Promise<boolean> {
  const now = new Date().toISOString();
  const events = (await edb.events.bulkGet(eventIds)).filter(Boolean) as PosEvent[];
  let anyPoisoned = false;
  for (const e of events) {
    const attempts = e.attempts + 1;
    // A permanent rejection (400/404/409/422 — the request reached the
    // server and it said no) still gets a couple of retries before being
    // marked dead: cheap insurance against a false-permanent classification
    // (e.g. a 409 caused by a race that resolves itself a moment later).
    const poisoned = err.permanent && attempts >= 3;
    if (poisoned) anyPoisoned = true;
    await edb.events.update(e.id, {
      syncState: poisoned ? 'POISONED' : 'DEGRADED',
      attempts,
      lastAttemptAt: now,
      lastError: err.message,
    });
    if (poisoned) reportDeadLetter({ ...e, lastError: err.message }, attempts).catch(() => {});
  }
  reflectOrderSyncState(eventIds, anyPoisoned ? 'POISONED' : 'DEGRADED');
  return anyPoisoned;
}

// When an order's CREATE_ORDER task is poisoned, it will never get a
// serverId — every other event still queued for that order (status
// changes, item adds, payment) can then never ship either, since they all
// require one. Left alone they'd sit QUEUED forever, invisibly blocking
// hasUnsyncedEvents() (and so the sign-out guard) with no way to resolve.
// Cascade the poison so the whole order surfaces as one dead-letter needing
// human review (Phase 6's admin dashboard), not N silently stuck events.
async function cascadePoisonOrder(orderId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  const rest = await edb.events
    .where('aggregateId').equals(orderId)
    .and((e) => e.syncState === 'QUEUED' || e.syncState === 'DEGRADED' || e.syncState === 'BLOCKED')
    .toArray();
  for (const e of rest) {
    await edb.events.update(e.id, { syncState: 'POISONED', lastAttemptAt: now, lastError: reason });
    reportDeadLetter({ ...e, lastError: reason }, e.attempts).catch(() => {});
  }
  if (rest.length) reflectOrderSyncState(rest.map((e) => e.id), 'POISONED');
}

function reflectOrderSyncState(eventIds: string[], state: 'SYNCED' | 'PENDING' | 'DEGRADED' | 'POISONED'): void {
  // Best-effort UI reflection — looks up which order(s) these events belong
  // to via the current view snapshot rather than re-reading the events
  // (already known by the caller's aggregateId in practice, but this stays
  // correct even if called with a mixed batch).
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
}

async function probeHealth(): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/health`, { method: 'GET' });
    if (res.ok) {
      consecutiveProbeSuccesses++;
      if (consecutiveProbeSuccesses >= CIRCUIT_CLOSE_THRESHOLD) {
        circuitOpen = false;
        consecutiveFailures = 0;
        consecutiveProbeSuccesses = 0;
        if (probeHandle) { clearInterval(probeHandle); probeHandle = null; }
        kickOutbox();
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

// ─── Drain loop ──────────────────────────────────────────────────────────

async function runChain(aggregateId: string, chain: OutboxTask[]): Promise<void> {
  for (const task of chain) {
    if (circuitOpen) return;
    await markInflight(task.eventIds);
    try {
      await runTask(task);
      await markConfirmed(task.eventIds);
      consecutiveFailures = 0;
    } catch (err) {
      const te = err instanceof TaskError ? err : new TaskError((err as Error)?.message ?? 'Unknown error', false);
      const poisoned = await markFailed(task.eventIds, te);
      if (poisoned && task.kind === 'CREATE_ORDER') {
        await cascadePoisonOrder(aggregateId, 'Order create was rejected by the server — see lastError on the original event');
      }
      if (!te.permanent) {
        consecutiveFailures++;
        if (consecutiveFailures >= CIRCUIT_TRIP_THRESHOLD) tripCircuit();
      }
      return; // stop this aggregate's chain on first failure — later tasks
              // in the chain likely depend on it (e.g. status after items)
    }
  }
}

async function drain(): Promise<void> {
  if (draining || circuitOpen) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  draining = true;
  try {
    const chains = await deriveTaskChains();
    const entries = Array.from(chains.entries());
    for (let i = 0; i < entries.length; i += MAX_CONCURRENT_AGGREGATES) {
      const batch = entries.slice(i, i + MAX_CONCURRENT_AGGREGATES);
      await Promise.all(batch.map(([aggregateId, chain]) => runChain(aggregateId, chain)));
      if (circuitOpen) break;
    }
  } finally {
    draining = false;
  }
}

export function kickOutbox(): void {
  if (kickScheduled) return;
  kickScheduled = true;
  // Debounced to the next macrotask — commands.ts's emit() calls this on
  // every append, and a loop of N addItem() calls (building a new order)
  // would otherwise schedule N redundant drain passes back to back.
  setTimeout(() => {
    kickScheduled = false;
    drain().catch(console.error);
  }, 50);
}

export function startOutbox(pollMs = 5000): () => void {
  if (started) return () => {};
  started = true;

  kickOutbox();
  intervalHandle = setInterval(() => kickOutbox(), pollMs);

  const handleOnline = () => kickOutbox();
  window.addEventListener('online', handleOnline);

  return () => {
    if (intervalHandle) clearInterval(intervalHandle);
    if (probeHandle) clearInterval(probeHandle);
    window.removeEventListener('online', handleOnline);
    started = false;
  };
}

// ─── Status for UI (sign-out guard, offline badges) ─────────────────────

export async function hasUnsyncedEvents(): Promise<boolean> {
  const count = await edb.events.where('syncState').anyOf(['QUEUED', 'BLOCKED', 'INFLIGHT', 'DEGRADED']).count();
  return count > 0;
}

export interface UnsyncedSummary {
  count: number;
  poisoned: number;
  oldestAt: string | null;
}

export async function getUnsyncedSummary(): Promise<UnsyncedSummary> {
  const pending = await edb.events.where('syncState').anyOf(['QUEUED', 'BLOCKED', 'INFLIGHT', 'DEGRADED']).toArray();
  const poisoned = await edb.events.where('syncState').equals('POISONED').count();
  pending.sort((a, b) => a.seq - b.seq);
  return {
    count: pending.length,
    poisoned,
    oldestAt: pending[0]?.clientTime ?? null,
  };
}
