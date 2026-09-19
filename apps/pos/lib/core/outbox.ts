import {
  edb, type PosEvent, type SyncLane,
  NON_TERMINAL_STATES, EVENT_MAX_LIFETIME_MS, laneForEvents,
} from './event-log';
import { useViews, reconcileServerId, emergencyPrune } from './views';
import { getToken, getPosSession } from '@/lib/pos-session';
import { toast } from 'sonner';
import { API_URL, isApiConfigured, API_NOT_CONFIGURED } from '@/lib/api';
import { getTerminalId } from './event-log';
import { savedBreaks, replaySavedBreaks } from '@/lib/offline-break';
import { clearPendingShiftOpen, pendingShiftOpens, isShiftPendingOpen, readPendingShiftOpen, recordShiftAlias, resolveShiftId } from '@/lib/offline-shift';
import { getBrandingConfig } from '@/lib/branding-store';
import { cashMovements, replayCashMovements } from '@/lib/offline-cash';
import { kitchenReadyOperations, replayKitchenReady } from '@/lib/offline-kitchen';
import { markSessionExpired } from '@/lib/session-guard';

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


const DEFAULT_REQUEST_TIMEOUT_MS = 8000;      // spec: hard 8s AbortController
const DEFAULT_MAX_LIFETIME_MS = EVENT_MAX_LIFETIME_MS; // 24h from event-log.ts
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];
const DEGRADED_RETRY_MS = 60000;
// How long an order with no live items may sit before its events are treated as
// local-only (see deriveTaskChains). Far longer than createOrder → addItem.
const EMPTY_ORDER_GRACE_MS = 2 * 60 * 1000;
const CRITICAL_RETRY_MS = [500, 1000, 2000];  // spec: 3 fast retries for CRITICAL
// A payment waits longer than everything else — see runCriticalTask.
const CRITICAL_REQUEST_TIMEOUT_MS = 20000;

// Part 13 — the sync engine's tunables live in console settings and reach
// the terminal in pos_branding. Read live (cheap) with sane fallbacks.
function syncCfg(): { requestTimeoutMs: number; maxLifetimeMs: number; maxBatchSize: number } {
  try {
    const p = getBrandingConfig();
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
const PROBE_TIMEOUT_MS = 5000;

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
  | 'UPDATE_TABLE_STATUS' | 'REQUEST_BILL' | 'CLEAN_TABLE' | 'ASSIGN_WAITER';

interface OutboxTask {
  kind: TaskKind;
  aggregateId: string;
  eventIds: string[];
  lane: SyncLane;
  status?: string;                 // UPDATE_STATUS / UPDATE_TABLE_STATUS
  billRequestedAt?: string | null; // REQUEST_BILL
  waiter?: { waiterId: string | null; waiterName: string | null }; // ASSIGN_WAITER
  // CREATE_ORDER only: the subset of eventIds actually reflected in
  // createOrderBody (ORDER_CREATED + ITEM_ADDED). eventIds may carry other
  // event types too — bundled in only so a create can't outrun them and to
  // keep the "every pending event produces a task" invariant — but
  // createOrderBody has no channel for a payment, a status change, or a
  // bill request, so only bodyEventIds may be confirmed when this task
  // succeeds. See deriveTaskChains and confirmShippedEvents.
  bodyEventIds?: string[];
  // CREATE_ORDER only: this attempt wrote the create marker (see
  // beginCreateAttempt), so it is the one entitled to withdraw it.
  ownsCreateMarker?: boolean;
  // CREATE_ORDER only: the order's line ids when its body was built.
  bodyLineIds?: string[];
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

// One console error per session for a missing API address, not one per drain.
let configWarned = false;

// Set for the duration of a CRITICAL task so its requests get the longer budget
// without threading a timeout through buildOp/shipOps/runTaskViaRest.
let criticalTimeoutOverrideMs: number | null = null;

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
  timeoutMs = timeoutMs ?? criticalTimeoutOverrideMs ?? syncCfg().requestTimeoutMs;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    // Any answer other than "no such endpoint" proves we're talking to the
    // real API — see classifyHttpError's note on why that distinction is
    // load-bearing. 401/409/422 all count: only a real API produces them.
    if (res.status !== 404) markApiReachable();
    return res;
  } catch (err: any) {
    // Our own timeout surfaced as the browser's raw "signal is aborted without
    // reason", which then became an event's lastError and was shown to a
    // cashier verbatim in Settings → Sync & Data. Name it for what it is, and
    // classify it as retryable (it always was, but only by accident of falling
    // through to the generic non-permanent branch).
    if (timedOut || err?.name === 'AbortError') {
      throw new TaskError(`The server did not respond within ${Math.round(timeoutMs / 1000)}s`, false, { timedOut: true });
    }
    throw err;
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
  // The request went out and no answer came back: the server may or may not
  // have acted on it. Every other failure is a definite "it did not happen".
  timedOut: boolean;
  constructor(message: string, permanent: boolean, opts: { authExpired?: boolean; graceRetries?: number; timedOut?: boolean } = {}) {
    super(message);
    this.permanent = permanent;
    this.authExpired = opts.authExpired ?? false;
    this.graceRetries = opts.graceRetries ?? 0;
    this.timedOut = opts.timedOut ?? false;
  }
}

const AUTH_EXPIRED_ERROR = 'AUTH_EXPIRED';

// Has this terminal ever had a 2xx out of the API? Until it has, a 404 is far
// more likely to mean "we are pointed at the wrong host" than "the server
// looked and this order isn't there" — and the difference matters enormously,
// because a permanent classification POISONS the event and then
// cascadePoisonAggregate kills the whole order. A misconfigured
// NEXT_PUBLIC_API_URL used to send every request to the POS's own Next server,
// which 404s everything, which silently destroyed every order punched on that
// terminal. Set by markApiReachable() on any successful response.
let apiReachable = false;

function markApiReachable(): void {
  apiReachable = true;
}

function classifyHttpError(status: number): TaskError {
  if (status === 401) return new TaskError(AUTH_EXPIRED_ERROR, false, { authExpired: true });
  if (status === 403 || status === 408 || status === 429 || status >= 500) return new TaskError(`HTTP ${status}`, false);
  if (status === 404) {
    // Never poisoned a 404 before the API has proved it exists: that's a
    // deployment/config problem, not a business rejection, and it self-heals.
    if (!apiReachable) {
      return new TaskError(
        'HTTP 404 — the API did not recognise this endpoint. Check this terminal’s API address before anything is discarded.',
        false,
      );
    }
    // Once we know the API is real, a 404 on a specific resource is usually
    // genuine — but give it grace retries anyway: an order created seconds ago
    // can 404 against a lagging read path before its create has settled.
    return new TaskError('HTTP 404', true, { graceRetries: 2 });
  }
  // Other 4xx: the request reached the server and it said no. 409 is
  // race-prone (a duplicate that resolves itself) so it gets one grace retry;
  // 400/422 poison on the first failure (spec Part 12).
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

// Set by forceSyncNow. Anything that last failed before this moment is due
// again right away, whatever its backoff says. Without it, a payment that had
// been refused for hours (an expired sign-in, a long outage) sat on the
// 60-second retry step after the cause was fixed, and the close-shift screen,
// which flushes the queue before asking the server for totals, read them
// before that payment had been sent.
let forcedDueAt = 0;

function isDue(e: PosEvent, now: number): boolean {
  if (e.syncState === 'QUEUED' || e.syncState === 'BLOCKED') return true;
  if (e.syncState !== 'DEGRADED') return false;
  if (!e.lastAttemptAt) return true;
  const last = new Date(e.lastAttemptAt).getTime();
  if (last < forcedDueAt) return true;
  return now - last >= delayForAttempts(e.attempts);
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
  const createMarkers = await loadCreateMarkers();
  const markersToClear: string[] = [];

  // State writes this derivation implies. They used to be fired without
  // `await` from inside the loop, so the chain could be handed back before
  // IndexedDB had recorded that those events were SUPERSEDED/CONFIRMED — and
  // the next cycle could re-derive them. Collected here and flushed (awaited)
  // once, at the end.
  const toSupersede: string[] = [];
  const toConfirm: string[] = [];

  // Collapse a run of same-type events into a single task keyed on the
  // LATEST; the earlier ones are genuinely obsolete → mark them SUPERSEDED
  // (terminal) so they never ship on their own or count toward retries.
  const collapse = (events: PosEvent[]): PosEvent | null => {
    if (events.length === 0) return null;
    const latest = events[events.length - 1];
    toSupersede.push(...events.slice(0, -1).map((e) => e.id));
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
      if (leftoverTable.length) toConfirm.push(...leftoverTable.map((e) => e.id));
    } else if (aggType === 'SHIFT') {
      // Shift-lifecycle events ship synchronously from their own call sites
      // (POST /api/shifts/:id/open|close, and the pending-sync finalisation in
      // markShiftPendingSync/finalisePendingSyncShiftIfDrained). Recorded here
      // only for the local audit trail — nothing to queue.
      toConfirm.push(...events.map((e) => e.id));
      continue;
    } else {
      // ORDER
      const order = orders[aggregateId];
      // A missing projection is not a server acknowledgement. It may still be
      // rebuilding or waiting for the cached/server order to be imported.
      // Keep the original event retryable, especially collected payments.
      if (!order) continue;
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
        //
        // eventIds still carries EVERY pending event (so a payment or status
        // change can't be missed by the invariant check below, and so the
        // lane/opId accounting stays exactly as before) — but only
        // ORDER_CREATED/ITEM_ADDED are ever actually reflected in
        // createOrderBody (it reads current cart state directly for items,
        // and has no field for a payment, a status change, or a bill
        // request at all). bodyEventIds marks that subset so
        // confirmShippedEvents only confirms what was genuinely sent and
        // requeues the rest for the very next cycle, once hasServerId is
        // true and they can ship through their own proper task kind. Without
        // this split, a payment collected in the few seconds before a slow
        // (Neon cold-start) create response landed was marked CONFIRMED the
        // moment create succeeded, having never been transmitted at all —
        // the order settled on screen, the drawer never saw the money.
        if (order) {
          // commands.createOrder() always fires an immediate kick (ORDER_CREATED
          // is HIGH lane) the instant it's appended — before the awaited loop of
          // commands.addItem() calls that every one of its callers makes right
          // after has necessarily landed in the local event log yet. Shipping a
          // create for an order with zero live items right now would create a
          // real, permanent, zero-total order server-side, which then refuses to
          // ever be completed ("zero-total order needs manager approval") —
          // reproduced live going straight from a fresh cart to Charge. Leave it
          // queued rather than build a task for it; ITEM_ADDED's own kick (at
          // most ~200ms, or immediate once it lands) re-runs this the moment an
          // item exists, and the create ships whole, atomically, in one request.
          const hasLiveItems = order.items.some((i: any) => !i.voided);
          // Taken under a shift opened offline that the server hasn't been
          // told about yet: Order.shiftId is a foreign key, so the create
          // would be rejected and poison the order. It waits;
          // registerPendingShiftOpen runs at the start of every drain.
          if (isShiftPendingOpen(order.shiftId)) continue;
          if (hasLiveItems) {
            const bodyEventIds = events
              .filter((e) => e.type === 'ORDER_CREATED' || e.type === 'ITEM_ADDED')
              .map((e) => e.id);
            chain.push({
              kind: 'CREATE_ORDER', aggregateId, eventIds: events.map((e) => e.id),
              bodyEventIds, lane: laneOf(events),
            });
          } else {
            // Nothing to create: the order has no live items. Normally that is
            // the few milliseconds between createOrder and its first addItem,
            // so wait. But an order that was emptied (every line removed) or
            // cancelled before it ever synced stays that way, and waiting on it
            // kept one change "pending" forever: the sync indicator never
            // cleared and closing the shift reported an order that doesn't
            // exist. The server never needs to hear about an order that never
            // held anything, so those events end here.
            const newest = Math.max(...events.map((e) => Date.parse(e.clientTime) || 0));
            const hasPayment = events.some(e => e.type === 'PAYMENT_COLLECTED');
            if (!hasPayment && (ORDER_TERMINAL_STATUSES.has(order.status) || now - newest > EMPTY_ORDER_GRACE_MS)) {
              toConfirm.push(...events.map((e) => e.id));
            }
            continue;
          }
        }
      } else {
        let itemEvents = events.filter((e) => e.type === 'ITEM_ADDED');

        // The order has a server id but its ORDER_CREATED is still pending:
        // a create reached the server and its answer never reached us (it
        // timed out, or the page died mid-request), and the id arrived some
        // other way, usually the live-orders pull matching the order number.
        // That create already carried the lines recorded when it went out.
        // Shipping them again as ADD_ITEMS put every item on the ticket twice,
        // which is what an offline punch followed by a slow reconnect did.
        // They are confirmed here; only lines added after that create still
        // ship. With no marker there is no way to tell, and a missing line is
        // safer than a doubled one, so everything pending counts as carried.
        if (events.some((e) => e.type === 'ORDER_CREATED')) {
          const sent = createMarkers.get(aggregateId);
          const wasCarried = (e: PosEvent) => !sent || sent.has(e.payload?.lineId);
          const carried = itemEvents.filter(wasCarried);
          if (carried.length) {
            toConfirm.push(...carried.map((e) => e.id));
            itemEvents = itemEvents.filter((e) => !wasCarried(e));
          }
          if (createMarkers.has(aggregateId)) markersToClear.push(aggregateId);
        }
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
        // Waiter assignment had a command (commands.assignWaiter) and a reducer
        // case, but NO task here — so it fell through to the "local-only"
        // leftover branch below and was marked CONFIRMED without ever being
        // transmitted. The floor plan's own sheet worked around that with a raw
        // PUT, which is why nothing had noticed; but that raw call only works
        // on an order the server already has, and fails outright offline.
        const waiterEvents = events.filter((e) => e.type === 'WAITER_ASSIGNED');
        const latestWaiter = collapse(waiterEvents);
        if (latestWaiter) {
          chain.push({
            kind: 'ASSIGN_WAITER', aggregateId,
            waiter: {
              waiterId: latestWaiter.payload?.waiterId ?? null,
              waiterName: latestWaiter.payload?.waiterName ?? null,
            },
            eventIds: [latestWaiter.id], lane: laneOf([latestWaiter]),
          });
        }

        const latestPayment = collapse(paymentEvents);
        if (latestPayment) {
          chain.push({ kind: 'COLLECT_PAYMENT', aggregateId, eventIds: [latestPayment.id], lane: laneOf([latestPayment]) });
        }

        // Event types with a command but no server task yet — local-only.
        const handled = new Set([...itemEvents, ...statusEvents, ...paymentEvents, ...billEvents, ...waiterEvents].map((e) => e.id));
        const leftover = events.filter((e) => !handled.has(e.id));
        if (leftover.length) toConfirm.push(...leftover.map((e) => e.id));
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
      toConfirm.push(...events.map((e) => e.id));
    }
  }

  // Flush the derivation's own state writes before handing back the chains,
  // so the next cycle can never re-derive an event this one already retired.
  if (toSupersede.length) await markSuperseded(toSupersede);
  if (toConfirm.length) await markConfirmed(toConfirm);
  if (markersToClear.length) await edb.meta.bulkDelete(markersToClear.map(createMarkerKey));

  return chains;
}

// ─── Creates whose answer never arrived ───────────────────────────────────
//
// Before each create goes out, the line ids its body was built from are
// written to meta. A definite failure removes the marker again; a timeout, or the
// page dying mid-request, leaves it standing, because the server may have
// created the order. An earlier standing marker is never overwritten: the
// server keys creates on the order id, so if one got through, the FIRST one to
// get through is the order it has, and a retry only replays that answer.

const CREATE_MARKER_PREFIX = 'createAttempt:';
const createMarkerKey = (aggregateId: string) => `${CREATE_MARKER_PREFIX}${aggregateId}`;

async function loadCreateMarkers(): Promise<Map<string, Set<string>>> {
  const rows = await edb.meta.where('key').startsWith(CREATE_MARKER_PREFIX).toArray();
  return new Map(rows.map((r) => [r.key.slice(CREATE_MARKER_PREFIX.length), new Set<string>(r.value)]));
}

// Every line on the order when the body was built, voided ones included: a
// line voided before the create never needs shipping on its own either.
function linesOf(order: any): string[] {
  return (order?.items ?? []).map((it: any) => it.lineId).filter(Boolean);
}

async function beginCreateAttempt(task: OutboxTask): Promise<void> {
  if (task.kind !== 'CREATE_ORDER') return;
  const key = createMarkerKey(task.aggregateId);
  if (await edb.meta.get(key)) {
    task.ownsCreateMarker = false;
    return;
  }
  await edb.meta.put({ key, value: task.bodyLineIds ?? [] });
  task.ownsCreateMarker = true;
}

// The server certainly did not create the order on this attempt.
async function abandonCreateAttempt(task: OutboxTask): Promise<void> {
  if (task.kind !== 'CREATE_ORDER' || !task.ownsCreateMarker) return;
  task.ownsCreateMarker = false;
  await edb.meta.delete(createMarkerKey(task.aggregateId));
}

async function settleCreateAttempt(task: OutboxTask, err: unknown): Promise<void> {
  if (!(err instanceof TaskError && err.timedOut)) await abandonCreateAttempt(task);
}

// The server's order statuses are PENDING, IN_KITCHEN, READY, COMPLETED and
// CANCELLED. SERVED, VOIDED and WALKED_OUT are this terminal's own finer
// states; sent verbatim they were rejected by the database, reported as a
// server error, and retried forever, so "Served", whole-order voids and
// walk-outs never reached the server and the stuck change blocked closing
// the shift. Served food is still READY until paid; a void or a walk-out is
// a cancellation. (The server translates these too, for terminals that
// already have the old values queued.)
function statusForEvent(e: PosEvent): string {
  switch (e.type) {
    case 'ORDER_MARKED_READY': return 'READY';
    case 'ORDER_SERVED': return 'READY';
    case 'ORDER_CANCELLED': return 'CANCELLED';
    case 'ORDER_VOIDED': return 'CANCELLED';
    case 'ORDER_WALKED_OUT': return 'CANCELLED';
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
    shiftId: resolveShiftId(order.shiftId) || null,
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

// TERMINAL means "this order can never take another write" — the only
// state where a line item genuinely no longer matters to anyone.
const ORDER_TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'VOIDED', 'WALKED_OUT']);

// null = no item remains to ship on a terminal order. A missing aggregate
// returns undefined, never null: losing a projection is not an acknowledgement.
// undefined = do NOT touch task.eventIds — leave them exactly as they are so
// the next cycle tries again. Used when addItemsBody comes back empty for a
// still-open order: that's either a legitimate remove/void racing this
// build, or a real bug in lineId matching — buildOp can't tell those apart
// from here, and confirming the wrong one is silent, permanent data loss
// (an item the cashier believes is on the order, that the kitchen and the
// bill never see). Leaving it QUEUED costs nothing but a harmless retry in
// the safe case, and in the unsafe case keeps the event visible in the
// pending count (Home badge, Sync & Data) instead of vanishing.
async function buildOp(task: OutboxTask): Promise<BatchOp | null | undefined> {
  const orders = useViews.getState().orders;
  const order = orders[task.aggregateId];
  const opId = task.eventIds.join(',');

  switch (task.kind) {
    case 'CREATE_ORDER':
      if (!order) return undefined;
      task.bodyLineIds = linesOf(order);
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, idempotencyKey: task.aggregateId, body: createOrderBody(order) };
    case 'ADD_ITEMS': {
      if (!order) return undefined;
      const body = await addItemsBody(task, order);
      if (!body.items.length) {
        if (ORDER_TERMINAL_STATUSES.has(order.status)) return null;
        console.warn(`[outbox] ADD_ITEMS for order ${task.aggregateId} resolved to 0 items on a non-terminal order (status=${order.status}) — leaving queued instead of confirming, to avoid silently dropping it`, task.eventIds);
        return undefined;
      }
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `additems:${opId}`, body };
    }
    case 'UPDATE_STATUS':
      if (!order) return undefined;
      // Keyed like the others: a status change runs applyOrderStatusSideEffects
      // server-side (stock deduction on IN_KITCHEN, among others), so a re-sent
      // op is not harmlessly repeatable.
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `status:${opId}`, body: { status: task.status } };
    case 'COLLECT_PAYMENT':
      if (!order) return undefined;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `pay:${opId}`, body: collectPaymentBody(order) };
    case 'REQUEST_BILL':
      if (!order) return undefined;
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, idempotencyKey: `bill:${opId}`, body: { billRequestedAt: task.billRequestedAt ?? null } };
    case 'ASSIGN_WAITER':
      if (!order) return undefined;
      // No idempotency key: assignOrder just sets three columns, so replaying it
      // lands on the same state. A key would only pin the FIRST assignment's
      // response, which is wrong for a field a manager can legitimately change.
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: order.serverId ?? null, body: task.waiter ?? {} };
    case 'UPDATE_TABLE_STATUS':
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, body: { status: task.status } };
    case 'CLEAN_TABLE':
      return { opId, kind: task.kind, aggregateId: task.aggregateId, targetId: task.aggregateId, body: {} };
  }
}

// ─── REST fallback executors (used only if the batch endpoint 404s) ───────

// Returns whether the caller may confirm task.eventIds. Only ADD_ITEMS's
// empty-match case (see buildOp's comment — same bug, same fix, this is the
// REST-fallback twin of it) can come back false; everything else always
// completes with either a genuine confirm or a thrown TaskError.
async function runTaskViaRest(task: OutboxTask): Promise<boolean> {
  const orders = useViews.getState().orders;
  const order = orders[task.aggregateId];

  if (task.kind === 'CREATE_ORDER') {
    if (!order) return false;
    const body = JSON.stringify(createOrderBody(order));
    task.bodyLineIds = linesOf(order);
    await beginCreateAttempt(task);
    let res: Response;
    try {
      res = await fetchWithTimeout(`${API_URL}/api/orders`, { method: 'POST', headers: authHeaders(task.aggregateId), body });
    } catch (err) {
      await settleCreateAttempt(task, err);
      throw err;
    }
    if (!res.ok) {
      await abandonCreateAttempt(task);
      throw classifyHttpError(res.status);
    }
    const created = await res.json();
    reconcileServerId(task.aggregateId, created.id);
    return true;
  }
  if (task.kind === 'UPDATE_TABLE_STATUS') {
    const res = await fetchWithTimeout(`${API_URL}/api/tables/${task.aggregateId}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: task.status }) });
    if (!res.ok) throw classifyHttpError(res.status);
    return true;
  }
  if (task.kind === 'CLEAN_TABLE') {
    const res = await fetchWithTimeout(`${API_URL}/api/tables/${task.aggregateId}/clean`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw classifyHttpError(res.status);
    return true;
  }

  if (!order?.serverId) throw new TaskError('No serverId yet', false);
  if (task.kind === 'ASSIGN_WAITER') {
    const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}/assign`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(task.waiter ?? {}),
    });
    if (!res.ok) throw classifyHttpError(res.status);
    return true;
  }
  if (task.kind === 'ADD_ITEMS') {
    const body = await addItemsBody(task, order);
    if (!body.items.length) {
      if (ORDER_TERMINAL_STATUSES.has(order.status)) return true;
      console.warn(`[outbox] ADD_ITEMS (REST fallback) for order ${task.aggregateId} resolved to 0 items on a non-terminal order (status=${order.status}) — leaving queued instead of confirming`, task.eventIds);
      return false;
    }
    const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}/items`, { method: 'POST', headers: authHeaders(`additems:${task.eventIds.join(',')}`), body: JSON.stringify(body) });
    if (!res.ok) throw classifyHttpError(res.status);
    return true;
  }
  // The batch path has always sent an idempotency key for these; the REST
  // fallback sent none, so the one path most likely to be retried (the batch
  // endpoint is unavailable — i.e. something is already wrong) was the one with
  // no protection against a payment being applied twice.
  const opId = task.eventIds.join(',');
  const { body, idempotencyKey } =
    task.kind === 'COLLECT_PAYMENT' ? { body: collectPaymentBody(order), idempotencyKey: `pay:${opId}` }
    : task.kind === 'REQUEST_BILL' ? { body: { billRequestedAt: task.billRequestedAt ?? null }, idempotencyKey: `bill:${opId}` }
    : { body: { status: task.status }, idempotencyKey: `status:${opId}` };
  const res = await fetchWithTimeout(`${API_URL}/api/orders/${order.serverId}`, {
    method: 'PUT', headers: authHeaders(idempotencyKey), body: JSON.stringify(body),
  });
  if (!res.ok) throw classifyHttpError(res.status);
  return true;
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

// A successful task confirms only what it actually transmitted. For every
// task kind except CREATE_ORDER that's simply task.eventIds. A CREATE_ORDER
// task's eventIds can carry event types createOrderBody never sends (see
// deriveTaskChains) — those were left INFLIGHT by markInflight(task.eventIds)
// and must go back to QUEUED here, not be confirmed alongside the create,
// so the next cycle ships them for real once hasServerId is set.
async function confirmShippedEvents(task: OutboxTask): Promise<void> {
  let toConfirm = task.kind === 'CREATE_ORDER' && task.bodyEventIds ? task.bodyEventIds : task.eventIds;
  if (task.kind === 'CREATE_ORDER') {
    // A success here can be the server replaying an EARLIER attempt's create
    // (same idempotency key) that timed out on our side. That order holds
    // only the lines that attempt carried; anything added since must still
    // ship as ADD_ITEMS, so it goes back to the queue with the rest.
    const key = createMarkerKey(task.aggregateId);
    const marker = await edb.meta.get(key);
    if (marker) {
      const sent = new Set<string>(marker.value);
      const events = (await edb.events.bulkGet(toConfirm)).filter(Boolean) as PosEvent[];
      toConfirm = events.filter((e) => e.type !== 'ITEM_ADDED' || sent.has(e.payload?.lineId)).map((e) => e.id);
      await edb.meta.delete(key);
    }
  }
  await markConfirmed(toConfirm);
  if (toConfirm !== task.eventIds) {
    const confirmed = new Set(toConfirm);
    const leftover = task.eventIds.filter((id) => !confirmed.has(id));
    if (leftover.length) await edb.events.where('id').anyOf(leftover).modify({ syncState: 'QUEUED' });
  }
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

// Event ids already warned about by runWatchdog's stuck-payment check —
// per-event, not time-windowed, since the same event stays non-terminal
// across many 60s watchdog ticks and should only ever surface once.
const stalePaymentWarned = new Set<string>();
// The session lapsed: ask for the PIN in place (lib/session-guard.ts). The
// events stay queued and go on the next cycle after the token is renewed.
function notifyAuthExpiredOnce() {
  markSessionExpired();
}

// A poisoned event only ever showed up as a quiet dot in the top bar
// (SyncHealthDot) or a row in Settings -> Sync & Data — easy to miss on a
// busy floor, and for a payment specifically the cost of missing it is
// real money: the cashier sees "paid" on screen (views update the instant
// the event is appended, before any server round trip) and moves on, then
// finds out only at close-shift, hours later, that the server never
// actually recorded it. Surface it the moment it's known, by name, instead.
function notifyPaymentPoisoned(e: PosEvent, message: string) {
  const order = useViews.getState().orders[e.aggregateId];
  const label = order ? `${order.orderNumber}${order.tableLabel ? ` (Table ${order.tableLabel})` : ''}` : 'an order';
  toast.error(`Payment for ${label} did not reach the server: ${message}`, {
    duration: 15000,
    description: 'The order still shows as paid here, but the drawer total will not include it until this is resolved in Settings → Sync & Data.',
  });
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
    if (poisoned) {
      reportDeadLetter({ ...e, lastError: err.message }, attempts).catch(() => {});
      if (e.type === 'PAYMENT_COLLECTED') notifyPaymentPoisoned(e, err.message);
    }
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
  edb.events.bulkGet(eventIds).then((events) => {
    // Read the store AFTER the await, not before it. The previous version
    // captured `orders` up front and then spread those stale rows back over
    // the store once the bulkGet resolved — quietly reverting any change an
    // event applied to those same orders while this was in flight.
    const orders = useViews.getState().orders;
    const patch: Record<string, any> = {};
    for (const e of events) {
      if (!e || e.aggregateType !== 'ORDER') continue;
      const o = orders[e.aggregateId];
      if (o && o.syncState !== 'SYNCED') patch[e.aggregateId] = { ...o, syncState: state };
    }
    if (Object.keys(patch).length) {
      useViews.getState()._setSnapshot({ orders: { ...orders, ...patch } });
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
    // 5s, not 2s: /health runs a real database query, and a Neon cold start
    // alone can take longer than 2s. Too tight a budget and every probe fails
    // against an API that is up, so the breaker never closes on its own.
    const res = await fetchWithTimeout(`${API_URL}/health`, { method: 'HEAD' }, PROBE_TIMEOUT_MS);
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
  try {
    await runCriticalTaskInner(task);
  } finally {
    criticalTimeoutOverrideMs = null;
  }
}

async function runCriticalTaskInner(task: OutboxTask): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    if (circuitOpen) return;
    await markInflight(task.eventIds);
    try {
      // A payment gets a longer budget than the shared 8s. Completing an order
      // runs the whole side-effect bundle server-side (stock, loyalty, deals,
      // webhooks) on top of whatever the database is doing, and a Neon cold
      // start alone can eat most of 8s — so the request that matters most was
      // the one most likely to be cut off and retried. Retrying is safe (it's
      // idempotency-keyed), but each timeout still costs the cashier a red sync
      // indicator and a "still trying to sync" toast for a payment that was
      // about to succeed.
      criticalTimeoutOverrideMs = Math.max(syncCfg().requestTimeoutMs, CRITICAL_REQUEST_TIMEOUT_MS);
      if (batchEndpointAvailable) {
        const op = await buildOp(task);
        if (op === undefined) return; // leave queued — see buildOp's comment
        if (!op) { await markConfirmed(task.eventIds); return; }
        await shipOps([op], [task]);
      } else {
        const shouldConfirm = await runTaskViaRest(task);
        if (shouldConfirm) await confirmShippedEvents(task);
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
  for (const t of tasks) await beginCreateAttempt(t);
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}/api/pos/events/batch`, {
      method: 'POST',
      headers: authHeaders(),
      // The TERMINAL's id, not the signed-in user's — `getPosSession().userId`
      // was being sent here, so every batch was attributed to a person rather
      // than to the tablet that produced it, and server-side per-terminal
      // diagnostics were meaningless.
      body: JSON.stringify({ terminalId: await getTerminalId(), ops }),
    });
  } catch (err) {
    // network/timeout — every task in the batch degrades and retries
    const te = err instanceof TaskError ? err : new TaskError((err as Error)?.message ?? 'Batch request failed', false);
    for (const t of tasks) await settleCreateAttempt(t, te);
    for (const t of tasks) await markFailed(t.eventIds, te);
    noteFailure(te);
    throw te;
  }
  recordRtt(performance.now() - t0);

  if (res.status === 404) {
    batchEndpointAvailable = false;
    console.warn('[outbox] /api/pos/events/batch not available — falling back to REST');
    for (const t of tasks) await abandonCreateAttempt(t);
    for (const t of tasks) await edb.events.where('id').anyOf(t.eventIds).modify({ syncState: 'QUEUED' });
    return;
  }
  if (!res.ok) {
    const te = classifyHttpError(res.status);
    for (const t of tasks) await abandonCreateAttempt(t);
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
      await confirmShippedEvents(task);
    } else if (r.status === 424) {
      // "skipped — earlier op failed" — put it back to QUEUED for next cycle.
      failedAggs.add(task.aggregateId);
      await abandonCreateAttempt(task);
      await edb.events.where('id').anyOf(task.eventIds).modify({ syncState: 'QUEUED' });
    } else {
      await abandonCreateAttempt(task);
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
  if (draining || circuitOpen || !useViews.getState().isReady) return;
  // No API address configured: there is nowhere correct to send these. Leaving
  // them QUEUED (and letting the sync indicator show "stuck") is the only safe
  // behaviour — shipping at a guessed address is what poisoned real orders.
  if (!isApiConfigured()) {
    if (!configWarned) {
      configWarned = true;
      console.error(`[outbox] ${API_NOT_CONFIGURED}`);
    }
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  draining = true;
  try {
    await registerPendingShiftOpen();
    await replaySavedBreaks();
    await replayCashMovements();
    await replayKitchenReady();
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
          if (op === undefined) continue; // leave queued — see buildOp's comment
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
    // Spec Part 6 — if a shift was closed with events still queued and the
    // queue is now empty, tell the server to finalise it (PENDING_SYNC → CLOSED).
    // In `finally` because the commonest case is exactly the one that took
    // the early `return` above: nothing left to ship. Sitting after the block,
    // it never ran then, so a shift closed offline with its orders already
    // synced never had its close replayed and stayed OPEN on the server.
    await finalisePendingSyncShiftIfDrained().catch(() => {});
  }
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
      const shouldConfirm = await runTaskViaRest(task);
      if (shouldConfirm) await confirmShippedEvents(task);
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

  // An outage (or a device-clock jump) is not permission to abandon sales.
  // Keep transient failures durable and retryable until acknowledged.
  const nonTerminal = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).toArray();

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

  // A payment the server hasn't confirmed long after it was taken. This used
  // to toast each one after 90 seconds, offline or not: mid-service, over the
  // screen, telling staff to check "Sync & Data" for something that was
  // almost always just a slow or missing connection and fixed itself. The
  // payment is safe on the terminal either way, Close Shift counts it and
  // says it's still sending, and a payment the server actually REJECTS has
  // its own error (notifyPaymentPoisoned). What's left worth interrupting
  // for: the server is reachable, yet a payment has still not gone through
  // after 10 minutes. One message for all of them, in plain words, once.
  const STUCK_PAYMENT_MS = 10 * 60 * 1000;
  const reachable = !circuitOpen && navigator.onLine !== false;
  const stuckPayments = reachable
    ? nonTerminal.filter(
        (e) => e.type === 'PAYMENT_COLLECTED' && !stalePaymentWarned.has(e.id)
          && now - new Date(e.clientTime).getTime() > STUCK_PAYMENT_MS,
      )
    : [];
  if (stuckPayments.length) {
    for (const e of stuckPayments) stalePaymentWarned.add(e.id);
    const n = stuckPayments.length;
    toast.warning(`${n} payment${n === 1 ? '' : 's'} not sent to the server yet`, {
      duration: 12000,
      description: `${n === 1 ? 'It is' : 'They are'} saved on this device. Keep working, and let a manager know if this keeps showing.`,
    });
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

  // A backgrounded/locked tab throttles setInterval (Chrome can drop the
  // 5s kickOutbox loop to roughly once a minute, or suspend it entirely) —
  // exactly the profile a POS tablet sees overnight or between rushes. Found
  // live: PAYMENT_COLLECTED events dead-lettered with 0 attempts and
  // "Exceeded 24h max lifetime" — never once picked up by deriveTaskChains
  // in a full day, then killed by the watchdog purely on age. Re-kicking
  // (and re-running the watchdog, in case it also missed cycles) the moment
  // the tab is foregrounded again closes that window instead of waiting on
  // a throttled timer to eventually resume.
  const handleVisible = () => {
    if (document.visibilityState === 'visible') {
      kickOutbox('immediate');
      runWatchdog().catch(console.error);
    }
  };
  document.addEventListener('visibilitychange', handleVisible);
  window.addEventListener('focus', handleVisible);

  return () => {
    clearAllHandles();
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisible);
    window.removeEventListener('focus', handleVisible);
    started = false;
  };
}

// ─── Status for UI (sign-out guard, offline badges, Sync Status panel) ────

export async function hasUnsyncedEvents(): Promise<boolean> {
  const count = await edb.events.where('syncState').anyOf(NON_TERMINAL_STATES).count();
  return count > 0 || pendingShiftOpens().length > 0 || pendingShiftCloses().length > 0 || (await savedBreaks()).some(e => e.state !== 'confirmed') || (await cashMovements()).some(e => e.state !== 'confirmed') || (await kitchenReadyOperations()).some(e => e.state !== 'confirmed');
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
  /** No API address on this terminal — nothing can sync until one is set. */
  apiUnconfigured: boolean;
}

export async function getUnsyncedSummary(): Promise<UnsyncedSummary> {
  const breaks = await savedBreaks();
  const shiftOperations = pendingShiftCloses().length + pendingShiftOpens().length;
  const cash = await cashMovements();
  const pendingCash = cash.filter(e => e.state === 'pending').length;
  const rejectedCash = cash.filter(e => e.state === 'rejected').length;
  const kitchen = await kitchenReadyOperations();
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
    count: pending.length + pendingCash + kitchen.filter(e => e.state === 'pending').length + breaks.filter(e => e.state === 'pending').length + shiftOperations,
    poisoned: poisoned + rejectedCash + kitchen.filter(e => e.state === 'rejected').length + breaks.filter(e => e.state === 'rejected').length, abandoned, superseded, confirmedToday,
    oldestAt: pending[0]?.clientTime ?? null,
    authExpiredCount,
    blockedOnAuthOnly: pending.length > 0 && authExpiredCount === pending.length && pendingCash === 0 && shiftOperations === 0 && !breaks.some(e => e.state !== 'confirmed'),
    circuitOpen,
    stalled: pending.length > 0 && Date.now() - lastProgressAt > STALL_RESTART_AFTER_MS,
    avgRttMs: avg,
    apiUnconfigured: !isApiConfigured(),
  };
}

/** Never report a shift as synced merely because failed events left the retry queue. */
export async function getShiftSyncStatus(shiftId: string) {
  const cash = [...await cashMovements(shiftId), ...await savedBreaks(shiftId)].filter(e => e.state !== 'confirmed');
  const events = await edb.events.where('syncState')
    .anyOf([...NON_TERMINAL_STATES, 'POISONED', 'ABANDONED'])
    .and(e => resolveShiftId(e.shiftId) === resolveShiftId(shiftId)).toArray();
  const pending = events.filter(e => NON_TERMINAL_STATES.includes(e.syncState)).length;
  return {
    pending: pending + cash.filter(e => e.state === 'pending').length,
    rejected: events.length - pending + cash.filter(e => e.state === 'rejected').length,
    total: events.length + cash.length,
    payments: events.filter(e => e.type === 'PAYMENT_COLLECTED').map(e => ({
      orderId: e.aggregateId,
      rejected: e.syncState === 'POISONED' || e.syncState === 'ABANDONED',
      error: e.lastError,
    })),
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
    cash: (await cashMovements()).filter(e => e.state !== 'confirmed'),
    kitchen: (await kitchenReadyOperations()).filter(e => e.state !== 'confirmed'),
    breaks: (await savedBreaks()).filter(e => e.state !== 'confirmed'),
    shiftOpens: pendingShiftOpens(),
    shiftCloses: pendingShiftCloses().map(p => ({ shiftId: p.shiftId, actorId: p.actorId })),
  };
}

/** Retry the original operation without deleting its payment or changing the bill. */
export async function retryStuckEvent(eventId: string): Promise<void> {
  const root = await edb.events.get(eventId);
  if (!root || !['POISONED', 'ABANDONED'].includes(root.syncState)) return;
  const session = getPosSession();
  if (root.actorId !== session?.userId) throw new Error('Sign in as the staff member who saved this change to retry.');
  // A failed create can poison its whole chain. Replay in dependency order,
  // retaining ids/payloads so the server's idempotency checks still apply.
  const related = await edb.events.where('aggregateId').equals(root.aggregateId)
    .filter(e => e.actorId === root.actorId && ['POISONED', 'ABANDONED'].includes(e.syncState)).toArray();
  await edb.transaction('rw', edb.events, async () => {
    for (const e of related) await edb.events.update(e.id, { syncState: 'QUEUED', attempts: 0, lastAttemptAt: null, lastError: null });
  });
  reflectOrderSyncState(related.map(e => e.id), 'PENDING');
  forceSyncNow();
}

/** Manual "Force Sync Now" from the Sync Status panel. */
export function forceSyncNow(): void {
  forcedDueAt = Date.now();
  consecutiveFailures = 0;
  circuitOpen = false;
  kickOutbox('immediate');
}

/**
 * Send everything queued and wait for it, up to `timeoutMs`. Resolves with
 * how many changes are still unsent (0 = all through).
 *
 * For steps that ask the server a question about work this terminal may not
 * have sent yet. Closing a shift asked "is anything still open?" before
 * shipping the queue, so an order paid a few seconds earlier came back as
 * unpaid and blocked the close.
 */
export async function flushOutbox(timeoutMs = 8000): Promise<number> {
  forceSyncNow();
  const deadline = Date.now() + timeoutMs;
  // Stop as soon as nothing is moving: with the API down every send fails
  // fast, and waiting out the full timeout just parks the cashier on a
  // spinner. The caller's own sync step deals with what's left.
  const STALL_MS = 3000;
  let lastLeft = Infinity;
  let lastProgressAt = Date.now();
  for (;;) {
    const left = (await getUnsyncedSummary()).count;
    if (left === 0 || Date.now() >= deadline || circuitOpen) return left;
    if (left < lastLeft) { lastLeft = left; lastProgressAt = Date.now(); }
    else if (Date.now() - lastProgressAt >= STALL_MS) return left;
    await new Promise((r) => setTimeout(r, 400));
  }
}

/**
 * True when an order the server reports as still open is already settled on
 * this terminal (paid, cancelled, voided): the server just hasn't received it.
 */
export function isSettledLocally(serverOrder: { id?: string; orderNumber?: string }): boolean {
  const orders = useViews.getState().orders;
  const local = Object.values(orders).find(
    (o) => (serverOrder.id && (o.serverId === serverOrder.id || o.id === serverOrder.id)) ||
      (serverOrder.orderNumber && o.orderNumber === serverOrder.orderNumber),
  );
  return !!local && ORDER_TERMINAL_STATUSES.has(local.status);
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
  const cash = [...await cashMovements(), ...await savedBreaks()].filter(e => e.state !== 'confirmed').length;
  const kitchen = (await kitchenReadyOperations()).filter(e => e.state !== 'confirmed').length;
  return { payments, orders, other: other + cash + kitchen, total: pending.length + cash + kitchen };
}

// Set by the POS when a shift is closed with events still queued. When the
// outbox next drains to zero — this session or a later one — it POSTs
// sync-complete so the server flips the shift PENDING_SYNC → CLOSED.
const PENDING_SYNC_SHIFT_KEY = 'pos_pending_sync_shift';
// Set only when the close POST itself never reached the server (offline / 5xx).
// The shift is closed on the terminal but still OPEN server-side, so the close
// has to be replayed before sync-complete can mean anything.
const PENDING_SHIFT_CLOSE_KEY = 'pos_pending_shift_close';

interface PendingShiftClose { shiftId: string; payload?: unknown; actorId?: string }
const CLOSE_QUEUE_KEY = 'pos_shift_close_queue';
export function pendingShiftCloses(): PendingShiftClose[] {
  try {
    const queue = localStorage.getItem(CLOSE_QUEUE_KEY);
    if (queue) return JSON.parse(queue);
    const shiftId = localStorage.getItem(PENDING_SYNC_SHIFT_KEY);
    const raw = localStorage.getItem(PENDING_SHIFT_CLOSE_KEY);
    return shiftId ? [{ shiftId, payload: raw ? JSON.parse(raw) : undefined }] : [];
  } catch { return []; }
}
function saveShiftCloses(queue: PendingShiftClose[]) {
  localStorage.setItem(CLOSE_QUEUE_KEY, JSON.stringify(queue));
  if (queue.length) {
    localStorage.setItem(PENDING_SYNC_SHIFT_KEY, queue[0].shiftId);
    if (queue[0].payload !== undefined) localStorage.setItem(PENDING_SHIFT_CLOSE_KEY, JSON.stringify(queue[0].payload));
    else localStorage.removeItem(PENDING_SHIFT_CLOSE_KEY);
  } else {
    localStorage.removeItem(PENDING_SYNC_SHIFT_KEY);
    localStorage.removeItem(PENDING_SHIFT_CLOSE_KEY);
  }
}
export function markShiftPendingSync(shiftId: string, unsentClosePayload?: unknown): void {
  const queue = pendingShiftCloses();
  const index = queue.findIndex(p => resolveShiftId(p.shiftId) === resolveShiftId(shiftId));
  const entry = { ...(index < 0 ? {} : queue[index]), shiftId, actorId: getPosSession()?.userId,
    ...(unsentClosePayload !== undefined ? { payload: unsentClosePayload } : {}) };
  if (index < 0) queue.push(entry); else queue[index] = entry;
  try { saveShiftCloses(queue); }
  catch { throw new Error('Cannot save the shift close on this device. Keep the shift open and try again.'); }
}

async function closeAuthHeaders() {
  const pending = pendingShiftCloses()[0];
  if (!pending?.actorId || pending.actorId === getPosSession()?.userId) return authHeaders();
  const { savedTokenFor } = await import('@/lib/offline-auth');
  const token = savedTokenFor(pending.actorId);
  if (!token) throw new Error('The cashier must sign in to finish syncing their shift.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/**
 * What the server says a shift's status is, or null if it couldn't be asked.
 * A close whose answer was lost (the request timed out while the server was
 * still working) did land; this is how the terminal finds out.
 */
export async function serverShiftStatus(shiftId: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/shifts/${resolveShiftId(shiftId)}`, { headers: headers ?? authHeaders() });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return typeof body?.status === 'string' ? body.status : null;
  } catch {
    return null;
  }
}

/** Replay a close POST that never landed. Returns false if it still hasn't. */
async function replayPendingShiftClose(shiftId: string): Promise<boolean> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PENDING_SHIFT_CLOSE_KEY); } catch { /* ignore */ }
  if (!raw) return true; // nothing outstanding — the close already landed

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/shifts/${shiftId}/close`, {
      method: 'POST',
      headers: await closeAuthHeaders(),
      body: raw,
    });
    // 4xx here means the server already has it closed, or is refusing for a
    // reason replaying won't fix — either way stop retrying forever.
    // Refused: most often because the first attempt DID close it and only
    // its answer was lost (the close takes seconds on a remote database, and
    // the terminal gave up waiting), so the server no longer has it open and
    // says 404. Treating that as "try again" retried forever and left the
    // terminal on "Finishing sync · 0 changes". Ask what the shift is now.
    let landed = res.ok;
    if (!landed && res.status !== 401 && res.status !== 429 && res.status < 500) {
      const status = await serverShiftStatus(shiftId, await closeAuthHeaders());
      landed = status !== null && status !== 'OPEN';
      if (!landed && status === 'OPEN' && !closeRefusedShown) {
        // Still open and the server won't close it (e.g. an order it thinks
        // is unpaid). Replaying won't change that; someone has to look.
        closeRefusedShown = true;
        const body = await res.json().catch(() => ({}));
        const { toast } = await import('sonner');
        toast.error(`The server has not accepted this shift's close: ${body?.error ?? `HTTP ${res.status}`}. Ask a manager to close it from the dashboard.`, { duration: 15000 });
      }
    }
    if (landed) {
      const queue = pendingShiftCloses();
      if (queue[0]) { delete queue[0].payload; saveShiftCloses(queue); }
      return true;
    }
  } catch { /* still offline */ }
  return false;
}
let closeRefusedShown = false;

// ─── Shifts opened offline (lib/offline-shift.ts) ─────────────────────────

let shiftOpenErrorShown = false;

/**
 * Tell the server about a shift this terminal opened with no connection,
 * under the id the terminal gave it. Runs at the start of every drain, before
 * any order for that shift can be derived into a task.
 */
async function registerPendingShiftOpen(): Promise<void> {
  const p = readPendingShiftOpen();
  if (!p) return;
  const closing = pendingShiftCloses()[0];
  // Register, drain and close shifts chronologically. Otherwise a later offline
  // shift could be joined to yesterday's still-open server shift.
  if (closing && resolveShiftId(closing.shiftId) !== resolveShiftId(p.shiftId)) return;

  // The shift belongs to whoever opened it. If someone else is signed in now,
  // their token would register it under their name; use the opener's saved
  // one, or wait until the opener is back.
  const session = getPosSession();
  let token: string | null = null;
  if (session?.userId === p.userId) {
    token = getToken();
  } else {
    const { savedTokenFor } = await import('@/lib/offline-auth');
    token = savedTokenFor(p.userId);
  }
  if (!token) return;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}/api/shifts/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        branchId: p.branchId,
        openingFloat: p.openingFloat,
        clientShiftId: p.shiftId,
        openedAt: p.openedAt,
      }),
    });
  } catch {
    return; // still unreachable: next drain
  }

  if (res.ok) {
    clearPendingShiftOpen();
    toast.success('The shift you opened offline is now on the server.');
    return;
  }

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.idTaken) {
      // Practically impossible (20 random characters), but if it happens the
      // shift needs another name; orders reach it through the alias.
      const { newOfflineShiftId, queueShiftOpen } = await import('@/lib/offline-shift');
      const fresh = newOfflineShiftId();
      recordShiftAlias(p.shiftId, fresh);
      queueShiftOpen({ ...p, shiftId: fresh });
      return;
    }
    if (body?.shiftId) {
      await adoptServerShift(p.shiftId, body.shiftId);
      clearPendingShiftOpen();
      toast.info('A shift was already open for you on the server, so this terminal joined it.', { duration: 8000 });
      return;
    }
  }

  // Token being refreshed, rate limited, or the server struggling: try again.
  if (res.status === 401 || res.status === 429 || res.status >= 500) return;

  // Any other refusal won't fix itself. Say so once; the orders stay safe on
  // this terminal rather than being sent against a shift the server rejected.
  if (!shiftOpenErrorShown) {
    shiftOpenErrorShown = true;
    const body = await res.json().catch(() => ({}));
    toast.error(`The shift opened offline couldn't be registered: ${body?.error ?? `HTTP ${res.status}`}. Its orders are kept on this terminal; ask a manager.`, { duration: 15000 });
  }
}

/**
 * The server already had a shift open for this cashier, so the one opened
 * offline joins it: alias the id, and move everything on this terminal that
 * holds the old one.
 */
async function adoptServerShift(localId: string, serverId: string): Promise<void> {
  recordShiftAlias(localId, serverId);

  const { getPosShift, setPosShift } = await import('@/lib/pos-session');
  const current = getPosShift();
  if (current?.shiftId === localId) {
    // The joined shift's own opening time and float are the true ones: the
    // home screen's elapsed timer and the drawer expectation run off them.
    let openedAt = current.openedAt;
    let openingFloat = current.openingFloat;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/shifts/${serverId}`, { headers: authHeaders() });
      if (res.ok) {
        const s = await res.json();
        openedAt = s.openedAt ?? openedAt;
        openingFloat = s.openingFloat ?? openingFloat;
      }
    } catch { /* keep this terminal's values */ }
    setPosShift({ shiftId: serverId, openedAt, openingFloat });
  }

  const { useCartStore } = await import('@/lib/store');
  const session = useCartStore.getState().session;
  if (session.shiftId === localId) useCartStore.setState({ session: { ...session, shiftId: serverId } });

  try {
    const closes = pendingShiftCloses().map(p => p.shiftId === localId ? { ...p, shiftId: serverId } : p);
    saveShiftCloses(closes);
  } catch { /* ignore */ }

  // SHORT order numbers count per shift; carry the count over so the next
  // order doesn't restart at 001 and collide with one already taken.
  const from = await edb.meta.get(`orderSeq:${localId}`);
  if (from) {
    const to = await edb.meta.get(`orderSeq:${serverId}`);
    await edb.meta.put({ key: `orderSeq:${serverId}`, value: Math.max(Number(from.value) || 0, Number(to?.value) || 0) });
  }

  const orders = useViews.getState().orders;
  const patched: typeof orders = {};
  for (const [id, o] of Object.entries(orders)) patched[id] = o.shiftId === localId ? { ...o, shiftId: serverId } : o;
  useViews.getState()._setSnapshot({ orders: patched });
}

// One at a time: every drain ends here, and drains overlap (a kick lands while
// the previous finalise is still waiting on the network). Without this each
// one replayed the close and toasted "finished syncing" again.
let finalising = false;

async function finalisePendingSyncShiftIfDrained(): Promise<void> {
  if (finalising) return;
  finalising = true;
  try {
    await finalisePendingSyncShift();
  } finally {
    finalising = false;
  }
}

async function finalisePendingSyncShift(): Promise<void> {
  let localShiftId: string | null = null;
  try { localShiftId = localStorage.getItem(PENDING_SYNC_SHIFT_KEY); } catch { /* ignore */ }
  if (!localShiftId) return;
  // A shift opened AND closed offline: the server has to learn it exists
  // before a close for it can mean anything.
  if (isShiftPendingOpen(localShiftId)) return;
  const shiftId = resolveShiftId(localShiftId);

  const remaining = await getShiftSyncStatus(shiftId);
  if (remaining.pending > 0 || remaining.rejected > 0) return;

  // The close itself may never have reached the server (closed offline).
  // Replay it first — sync-complete is meaningless on a shift the server
  // still thinks is OPEN.
  if (!(await replayPendingShiftClose(shiftId))) return;

  const poisonedOrAbandoned = await edb.events.where('syncState').anyOf(['POISONED', 'ABANDONED']).count();
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/shifts/${shiftId}/sync-complete`, {
      method: 'POST',
      headers: await closeAuthHeaders(),
      // Nothing more to send — the server recomputes from the DB, which now
      // has every one of this shift's orders/payments.
      body: JSON.stringify({}),
    });
    if (res.ok) {
      saveShiftCloses(pendingShiftCloses().slice(1));
      kickOutbox('immediate');
      if (poisonedOrAbandoned === 0) {
        try {
          const { toast } = await import('sonner');
          toast.success('Your closed shift finished syncing.');
        } catch { /* ignore */ }
      }
    }
  } catch { /* offline — try again on the next drain */ }
}
