import { create } from 'zustand';
import { edb, type PosEvent } from './event-log';
import {
  deriveTableStatus,
  fromDbTableStatus,
  type DerivedTableStatus,
  type TableStatusOverride,
} from '@dineiz/schemas';

export interface OrderViewItem {
  lineId: string;
  itemId: string;
  itemName: string;
  variationId: string | null;
  variationName: string | null;
  qty: number;
  unitPrice: number;
  note: string | null;
  sentToKitchen: boolean;
  voided: boolean;
  // Carried through so the outbox can rebuild the exact POST /api/orders
  // options shape (variation + addOns) without depending on the cart store
  // still being populated at ship time — the cart is cleared the instant
  // the cashier navigates away, but the outbox may not drain until later.
  addOns: Array<{ id: string; name: string; price: number }>;
}

export type OrderStatus =
  | 'PENDING' | 'IN_KITCHEN' | 'READY' | 'SERVED' | 'COMPLETED'
  | 'CANCELLED' | 'VOIDED' | 'WALKED_OUT';

// Once an order reaches one of these, nothing server-side can legitimately
// move it backward — used by refreshOrders() below to refuse a stale
// "still active" answer from /api/orders/live for an order this terminal
// already knows is done.
const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>(['COMPLETED', 'CANCELLED', 'VOIDED', 'WALKED_OUT']);

export interface OrderView {
  id: string;
  // The server (Part I, not yet built) doesn't accept client-supplied order
  // ids yet — it always mints its own cuid. `serverId` is the reconciled
  // real id once the background create POST lands, needed only so
  // subsequent operations (payment, append-items) know what to PUT against.
  // `id` itself never changes — that's the whole point of client-owned
  // identity — this is purely a shipping-layer lookup.
  serverId: string | null;
  orderNumber: string;   // client-generated at creation, permanent
  tokenNumber: string | null;
  type: string;
  status: OrderStatus;
  tableId: string | null;
  tableLabel: string | null;
  guestCount: number | null;
  items: OrderViewItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountReason: string | null;
  netAmount: number;
  paymentMethod: string | null;
  // Only set for a SPLIT payment (multiple methods) — carried through so
  // the outbox can ship the exact per-method breakdown to the server
  // instead of collapsing it back into one line.
  payments: Array<{ method: string; amount: number; status?: string; transactionId?: string | null }> | null;
  redeemedPointsAmount: number | null;
  cashReceived: number;
  change: number;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  customerId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  assignedWaiterId: string | null;
  assignedWaiterName: string | null;
  /** Set when the guest asks for the bill — drives the table's BILL_REQUESTED status. */
  billRequestedAt: string | null;
  notes: string | null;
  // Non-POS creation sources (QR ordering, WhatsApp bot, aggregators) never
  // go through this terminal's event log at all — this field only exists so
  // orders merged in from the server (refreshOrders below) can be told apart
  // from ones this terminal actually created, for UI badges that already
  // depend on it (TicketsDashboard's QR/WhatsApp chips).
  source: string | null;
  createdAt: string;
  updatedAt: string;
  syncState: 'SYNCED' | 'PENDING' | 'DEGRADED' | 'POISONED';
  kotPrintedAt: string | null;
  billPrintedAt: string | null;
  receiptPrintedAt: string | null;
  cancellationKotPrintedAt: string | null;
  voidReason: string | null;
  walkOutReason: string | null;
}

export interface TableView {
  id: string;
  label: string;
  // DERIVED (spec Part 3) — never assigned a literal by an order event.
  // deriveTableStatus() from @dineiz/schemas is the only thing that sets it,
  // from the orders on the table + the three fields below.
  status: DerivedTableStatus;
  isActive: boolean;
  statusOverride: TableStatusOverride;
  /** Anchors the DIRTY→FREE timer; stamped when the table's last order completes. */
  lastCompletedAt: string | null;
  occupiedSince: string | null;
  activeOrderId: string | null;
  floorNumber: number;
  // Floor-plan geometry and waiter-assignment display — reference data that
  // never changes via an order/table-status event, only via
  // seedTablesFromServer (floor plan edits) or WAITER_ASSIGNED.
  capacity: number;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedWaiterId: string | null;
  assignedWaiterName: string | null;
  assignedWaiterColor: string | null;
}

export interface ShiftView {
  shiftId: string | null;
  status: 'CLOSED' | 'OPEN';
  openingFloat: number;
  openedAt: string | null;
  cashMovements: Array<{ type: 'IN' | 'OUT'; amount: number; reason: string; at: string }>;
  onBreak: boolean;
  breakStartedAt: string | null;
}

const EMPTY_SHIFT: ShiftView = {
  shiftId: null, status: 'CLOSED', openingFloat: 0, openedAt: null,
  cashMovements: [], onBreak: false, breakStartedAt: null,
};

interface ViewStore {
  orders: Record<string, OrderView>;
  tables: Record<string, TableView>;
  shift: ShiftView;
  isReady: boolean;

  _applyEvent: (e: PosEvent) => void;
  _setSnapshot: (partial: Partial<Pick<ViewStore, 'orders' | 'tables'>>) => void;
  _markReady: () => void;
}

// MODULE SCOPE — created once, survives every navigation. This (not the
// event log itself) is what actually fixes "table doesn't update across
// screens" and "tab switching is slow": every screen subscribes to the same
// store instance, which updates whether or not the screen mounted the
// action that changed it.
export const useViews = create<ViewStore>((set) => ({
  orders: {},
  tables: {},
  shift: EMPTY_SHIFT,
  isReady: false,

  _applyEvent: (e) => {
    // A single malformed / unexpected event must never abort a replay — that
    // would leave `rebuildViews()` rejected and, downstream, the whole screen
    // without orders or a floor plan. Isolate each event.
    try {
      set((state) => reduce(state, e));
    } catch (err) {
      console.error('[views] skipped a bad event during replay', e?.type, e?.seq, err);
    }
  },
  _setSnapshot: (partial) => set(partial),
  _markReady: () => set({ isReady: true }),
}));

// ─── THE REDUCER: pure function, event → new state ──────────────────────────

function readCleaningMinutes(): number {
  try {
    const b = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const m = Number(b.tableCleaningMinutes ?? b.pos?.tableCleaningMinutes);
    return Number.isFinite(m) && m >= 0 ? m : 5;
  } catch {
    return 5;
  }
}

function reduce(state: ViewStore, e: PosEvent): Partial<ViewStore> {
  const orders = { ...state.orders };
  const tables = { ...state.tables };
  let shift = state.shift;

  // Spec Part 3 — the reducer never assigns a table a literal status. Cases
  // that affect a table just record its id here; a single pass at the end
  // re-derives every touched table from the orders on it (+ its override)
  // with the same deriveTableStatus() the server uses.
  const touchedTables = new Set<string>();
  const touch = (tableId: string | null | undefined) => {
    if (tableId) touchedTables.add(tableId);
  };

  const patchOrder = (patch: Partial<OrderView>) => {
    const o = orders[e.aggregateId];
    if (!o) return;
    orders[e.aggregateId] = { ...o, ...patch, updatedAt: e.clientTime };
  };

  switch (e.type) {
    case 'ORDER_CREATED': {
      orders[e.aggregateId] = {
        id: e.aggregateId,
        serverId: null,
        orderNumber: e.payload.orderNumber, // ALREADY EXISTS, permanent
        tokenNumber: e.payload.tokenNumber ?? null,
        type: e.payload.type,
        status: 'PENDING',
        tableId: e.payload.tableId ?? null,
        tableLabel: e.payload.tableLabel ?? null,
        guestCount: e.payload.guestCount ?? null,
        items: [],
        subtotal: 0, taxAmount: 0, discountAmount: 0, discountReason: null, netAmount: 0,
        paymentMethod: null, payments: null, redeemedPointsAmount: null, cashReceived: 0, change: 0,
        shiftId: e.shiftId,
        cashierId: e.actorId,
        cashierName: e.actorName,
        customerId: null,
        customerPhone: e.payload.customerPhone ?? null,
        customerName: null,
        assignedWaiterId: null,
        assignedWaiterName: null,
        billRequestedAt: null,
        notes: e.payload.notes ?? null,
        source: null, // this terminal created it — never a QR/WhatsApp/aggregator order
        createdAt: e.clientTime,
        updatedAt: e.clientTime,
        syncState: 'PENDING',
        kotPrintedAt: null,
        billPrintedAt: null,
        receiptPrintedAt: null,
        cancellationKotPrintedAt: null,
        voidReason: null,
        walkOutReason: null,
      };
      touch(e.payload.tableId ?? null);
      break;
    }
    case 'ITEM_ADDED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        items: [...o.items, {
          lineId: e.payload.lineId,
          itemId: e.payload.itemId,
          itemName: e.payload.itemName,
          variationId: e.payload.variationId ?? null,
          variationName: e.payload.variationName ?? null,
          qty: e.payload.qty,
          unitPrice: e.payload.unitPrice,
          note: e.payload.note ?? null,
          sentToKitchen: false,
          voided: false,
          addOns: e.payload.addOns ?? [],
        }],
        updatedAt: e.clientTime,
      };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'ITEM_QTY_CHANGED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        items: o.items.map((i) => (i.lineId === e.payload.lineId ? { ...i, qty: e.payload.qty } : i)),
        updatedAt: e.clientTime,
      };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'ITEM_REMOVED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        items: o.items.filter((i) => i.lineId !== e.payload.lineId),
        updatedAt: e.clientTime,
      };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'ITEM_VOIDED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        items: o.items.map((i) => (i.lineId === e.payload.lineId ? { ...i, voided: true } : i)),
        updatedAt: e.clientTime,
      };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'ITEM_NOTE_CHANGED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        items: o.items.map((i) => (i.lineId === e.payload.lineId ? { ...i, note: e.payload.note } : i)),
        updatedAt: e.clientTime,
      };
      break;
    }
    case 'ORDER_NOTE_CHANGED': {
      patchOrder({ notes: e.payload.note });
      break;
    }
    case 'DISCOUNT_APPLIED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o, discountAmount: e.payload.amount, discountReason: e.payload.reason ?? null, updatedAt: e.clientTime,
      };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'DISCOUNT_REMOVED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = { ...o, discountAmount: 0, discountReason: null, updatedAt: e.clientTime };
      recalc(orders, e.aggregateId);
      break;
    }
    case 'ORDER_SENT_TO_KITCHEN': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        status: 'IN_KITCHEN',
        items: o.items.map((i) => ({ ...i, sentToKitchen: true })),
        updatedAt: e.clientTime,
      };
      touch(o.tableId);
      break;
    }
    case 'ORDER_MARKED_READY': {
      patchOrder({ status: 'READY' });
      touch(orders[e.aggregateId]?.tableId);
      break;
    }
    case 'ORDER_SERVED': {
      patchOrder({ status: 'SERVED' });
      touch(orders[e.aggregateId]?.tableId);
      break;
    }
    case 'PAYMENT_COLLECTED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        status: 'COMPLETED',
        paymentMethod: e.payload.method,
        payments: e.payload.payments ?? null,
        redeemedPointsAmount: e.payload.redeemedPointsAmount ?? null,
        cashReceived: e.payload.cashReceived ?? 0,
        change: e.payload.change ?? 0,
        taxAmount: e.payload.taxAmount ?? o.taxAmount,
        netAmount: e.payload.total ?? o.netAmount,
        updatedAt: e.clientTime,
      };
      // Stamp the table's cleaning-timer anchor, then re-derive (→ DIRTY).
      if (o.tableId && tables[o.tableId]) {
        tables[o.tableId] = { ...tables[o.tableId], lastCompletedAt: e.clientTime };
      }
      touch(o.tableId);
      break;
    }
    case 'ORDER_CANCELLED':
    case 'ORDER_VOIDED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        status: e.type === 'ORDER_VOIDED' ? 'VOIDED' : 'CANCELLED',
        voidReason: e.payload?.reason ?? null,
        updatedAt: e.clientTime,
      };
      touch(o.tableId); // nobody ate — re-derive frees it (no lastCompletedAt stamp)
      break;
    }
    case 'ORDER_WALKED_OUT': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o, status: 'WALKED_OUT', walkOutReason: e.payload?.reason ?? null, updatedAt: e.clientTime,
      };
      touch(o.tableId);
      break;
    }
    case 'CUSTOMER_ATTACHED': {
      patchOrder({
        customerId: e.payload.customerId ?? null,
        customerPhone: e.payload.phone ?? null,
        customerName: e.payload.name ?? null,
      });
      break;
    }
    case 'ORDER_ADOPTED': {
      // Orphan pulled into a new shift (spec Part 2). Locally, re-home it so
      // it shows on the adopting cashier's shift-scoped board straight away.
      patchOrder({ shiftId: e.payload.intoShiftId ?? e.shiftId });
      touch(orders[e.aggregateId]?.tableId);
      break;
    }
    case 'WAITER_ASSIGNED': {
      patchOrder({ assignedWaiterId: e.payload.waiterId ?? null, assignedWaiterName: e.payload.waiterName ?? null });
      // Mirrored onto the table too, same denormalization the server
      // already does (ClientTableMap shows the waiter avatar directly on
      // the floor plan tile, not just inside the order popup).
      const o = orders[e.aggregateId];
      if (o?.tableId && tables[o.tableId]) {
        tables[o.tableId] = {
          ...tables[o.tableId],
          assignedWaiterId: e.payload.waiterId ?? null,
          assignedWaiterName: e.payload.waiterName ?? null,
          assignedWaiterColor: e.payload.waiterColor ?? tables[o.tableId].assignedWaiterColor,
        };
      }
      break;
    }
    case 'ORDER_MOVED_TO_TABLE': {
      const o = orders[e.aggregateId];
      if (!o) break;
      const fromTableId = e.payload.fromTableId ?? o.tableId ?? null;
      const newTableId = e.payload.toTableId;
      orders[e.aggregateId] = { ...o, tableId: newTableId, tableLabel: e.payload.toTableLabel ?? o.tableLabel, updatedAt: e.clientTime };
      touch(fromTableId);
      touch(newTableId);
      break;
    }
    case 'BILL_REQUESTED': {
      // Guest asked for the bill — mark the order, re-derive the table
      // (→ BILL_REQUESTED). payload.cancel === true clears it.
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        billRequestedAt: e.payload?.cancel ? null : e.clientTime,
        updatedAt: e.clientTime,
      };
      touch(o.tableId);
      break;
    }
    case 'TABLE_STATUS_CHANGED': {
      // Manager override ONLY — RESERVED / INACTIVE / MERGED, or clearing it.
      // Anything else (occupied, dirty, bill_requested) is derived, not set.
      const t = tables[e.aggregateId];
      if (!t) break;
      const raw = String(e.payload.status ?? '').toUpperCase();
      const override: TableStatusOverride =
        raw === 'RESERVED' || raw === 'INACTIVE' || raw === 'MERGED' ? (raw as TableStatusOverride) : null;
      tables[e.aggregateId] = { ...t, statusOverride: override };
      touch(e.aggregateId);
      break;
    }
    case 'TABLE_CLEANED': {
      // Manager marked the table clean before the cleaning timer elapsed.
      const t = tables[e.aggregateId];
      if (!t) break;
      tables[e.aggregateId] = { ...t, lastCompletedAt: null };
      touch(e.aggregateId);
      break;
    }
    case 'TABLE_MERGED': {
      // The source table is folded into the destination: mark it MERGED
      // (an override that beats derivation) and re-derive both.
      const from = tables[e.aggregateId];
      if (from) tables[e.aggregateId] = { ...from, statusOverride: 'MERGED' };
      touch(e.aggregateId);
      touch(e.payload.intoTableId);
      break;
    }
    case 'TABLE_SPLIT': {
      // Clear the source's MERGED override (if any) and re-derive every table
      // involved; seat/order allocation is a follow-up ORDER_MOVED_TO_TABLE.
      const from = tables[e.aggregateId];
      if (from) tables[e.aggregateId] = { ...from, statusOverride: null };
      touch(e.aggregateId);
      for (const newTableId of e.payload.newTableIds ?? []) touch(newTableId);
      break;
    }
    case 'SHIFT_OPENED': {
      shift = {
        shiftId: e.aggregateId, status: 'OPEN', openingFloat: e.payload.openingFloat ?? 0,
        openedAt: e.clientTime, cashMovements: [], onBreak: false, breakStartedAt: null,
      };
      break;
    }
    case 'SHIFT_CLOSED': {
      if (shift.shiftId === e.aggregateId) shift = { ...EMPTY_SHIFT };
      break;
    }
    case 'BREAK_STARTED': {
      if (shift.shiftId === e.aggregateId) shift = { ...shift, onBreak: true, breakStartedAt: e.clientTime };
      break;
    }
    case 'BREAK_ENDED': {
      if (shift.shiftId === e.aggregateId) shift = { ...shift, onBreak: false, breakStartedAt: null };
      break;
    }
    case 'CASH_IN':
    case 'CASH_OUT': {
      if (shift.shiftId === e.aggregateId) {
        shift = {
          ...shift,
          cashMovements: [...shift.cashMovements, {
            type: e.type === 'CASH_IN' ? 'IN' : 'OUT',
            amount: e.payload.amount, reason: e.payload.reason ?? '', at: e.clientTime,
          }],
        };
      }
      break;
    }
    case 'KOT_PRINTED': {
      patchOrder({ kotPrintedAt: e.clientTime });
      break;
    }
    case 'BILL_PRINTED': {
      patchOrder({ billPrintedAt: e.clientTime });
      break;
    }
    case 'RECEIPT_PRINTED': {
      patchOrder({ receiptPrintedAt: e.clientTime });
      break;
    }
    case 'CANCELLATION_KOT_PRINTED': {
      patchOrder({ cancellationKotPrintedAt: e.clientTime });
      break;
    }
    // MANAGER_APPROVED / MANAGER_DENIED carry no view-state change of their
    // own — they're an audit trail attached to whatever action they gated
    // (a discount, a void, a walk-out), which already records its own
    // approverId in that action's payload. These exist in the log purely so
    // the approval decision itself is a permanent, separately-queryable
    // record once Part I (server ingestion) ships them to AuditLog.
    case 'MANAGER_APPROVED':
    case 'MANAGER_DENIED':
      break;
  }

  // Spec Part 3 — single derivation pass for every table this event touched.
  if (touchedTables.size > 0) {
    const cleaningMinutes = readCleaningMinutes();
    const now = Date.now();
    for (const tableId of Array.from(touchedTables)) {
      const t = tables[tableId];
      if (t) tables[tableId] = deriveTableView(t, orders, cleaningMinutes, now);
    }
  }

  return { orders, tables, shift };
}

/** Re-derive one table's view row from the orders on it + its own fields. */
function deriveTableView(
  t: TableView,
  orders: Record<string, OrderView>,
  cleaningMinutes: number,
  now: number,
): TableView {
  const onTable = Object.values(orders).filter((o) => o.tableId === t.id);
  const status = deriveTableStatus({
    isActive: t.isActive,
    statusOverride: t.statusOverride,
    activeOrders: onTable.map((o) => ({ status: o.status, billRequestedAt: o.billRequestedAt })),
    lastCompletedAt: t.lastCompletedAt,
    cleaningMinutes,
    now,
  });
  const busy = status === 'OCCUPIED' || status === 'BILL_REQUESTED';
  const activeOrderId = busy
    ? (onTable.find((o) => ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'].includes(o.status))?.id
        ?? t.activeOrderId ?? null)
    : null;
  return {
    ...t,
    status,
    occupiedSince: busy ? (t.occupiedSince ?? new Date(now).toISOString()) : null,
    activeOrderId,
  };
}

// ─── Client-side table reconciliation (spec Part 3, 60s) ───────────────────
//
// The reducer derives table status on every event, but the DIRTY→FREE
// transition is purely time-based — no event fires when the cleaning window
// elapses. This sweep re-derives every table so a table that's been DIRTY
// long enough silently drops to FREE, and corrects any other drift.
export function reconcileTables(): void {
  const { tables, orders } = useViews.getState();
  const cleaningMinutes = readCleaningMinutes();
  const now = Date.now();
  let changed = 0;
  const next: Record<string, TableView> = {};
  for (const [id, t] of Object.entries(tables)) {
    const d = deriveTableView(t, orders, cleaningMinutes, now);
    next[id] = d;
    if (d.status !== t.status || d.activeOrderId !== t.activeOrderId) {
      changed++;
      if (d.status !== t.status) {
        console.warn(`[reconcileTables] ${t.label}: ${t.status} → ${d.status}`);
      }
    }
  }
  if (changed > 0) useViews.getState()._setSnapshot({ tables: next });
}

export function startTableReconcile(intervalMs = 60_000): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = setInterval(() => reconcileTables(), intervalMs);
  return () => clearInterval(h);
}

function recalc(orders: Record<string, OrderView>, orderId: string) {
  const o = orders[orderId];
  if (!o) return;
  const active = o.items.filter((i) => !i.voided);
  const subtotal = active.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  let branding: any = {};
  try { branding = JSON.parse(localStorage.getItem('pos_branding') ?? '{}'); } catch {}
  const rate = branding.cashTaxRate ?? 5;
  const taxAmount = Math.round((subtotal - o.discountAmount) * (rate / 100));
  orders[orderId] = { ...o, subtotal, taxAmount, netAmount: subtotal - o.discountAmount + taxAmount };
}

// ─── REBUILD: replay all events on cold start ───────────────────────────────

export async function rebuildViews(): Promise<void> {
  const snapshot = await edb.views.get('snapshot');
  if (snapshot) {
    useViews.getState()._setSnapshot(snapshot.value);
  }
  const lastSeq = snapshot?.version ?? 0;
  const events = await edb.events.where('seq').above(lastSeq).sortBy('seq');
  const apply = useViews.getState()._applyEvent;
  for (const e of events) apply(e);

  // Re-apply any serverId reconciliations persisted by reconcileServerId —
  // these aren't events (they're a shipping-layer detail, not a fact about
  // the order), so replaying the log alone won't restore them.
  const mappings = await edb.meta.where('key').startsWith('serverId:').toArray();
  if (mappings.length > 0) {
    const cur = useViews.getState().orders;
    const patched = { ...cur };
    for (const m of mappings) {
      const orderId = m.key.slice('serverId:'.length);
      if (patched[orderId]) patched[orderId] = { ...patched[orderId], serverId: m.value, syncState: 'SYNCED' };
    }
    useViews.getState()._setSnapshot({ orders: patched });
  }

  useViews.getState()._markReady();
}

// ─── SNAPSHOT: compact the log so replay stays fast ─────────────────────────

export async function snapshotViews(): Promise<void> {
  const s = useViews.getState();
  const maxSeq = await edb.events.orderBy('seq').last();
  await edb.views.put({
    key: 'snapshot',
    value: { orders: s.orders, tables: s.tables },
    version: maxSeq?.seq ?? 0,
  });
  // Prune confirmed events older than 7 days
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
  await edb.events
    .where('syncState').equals('CONFIRMED')
    .and((e) => e.clientTime < cutoff)
    .delete();
}

// ─── Emergency prune (spec Part 12: IndexedDB quota exceeded) ──────────────
//
// Called when a write to the event log fails with QuotaExceededError. Take a
// fresh snapshot so the terminal states can be rebuilt, then aggressively
// drop every event that has already reached a terminal state — CONFIRMED,
// SUPERSEDED and ABANDONED (the last is already dead-lettered server-side).
// Events still trying to sync (QUEUED/BLOCKED/INFLIGHT/DEGRADED) and POISONED
// ones needing human review are NEVER dropped.
let emergencyPruneWarnedAt = 0;
export async function emergencyPrune(): Promise<void> {
  try {
    await snapshotViews();
    const dropped = await edb.events
      .where('syncState').anyOf(['CONFIRMED', 'SUPERSEDED', 'ABANDONED'])
      .delete();
    console.warn(`[emergencyPrune] storage full — dropped ${dropped} terminal event(s)`);
    const now = Date.now();
    if (now - emergencyPruneWarnedAt > 60 * 60 * 1000) {
      emergencyPruneWarnedAt = now;
      try {
        const { toast } = await import('sonner');
        toast.warning('This terminal is low on storage. Old synced records were cleared; unsynced work is safe.', { duration: 8000 });
      } catch { /* toast not available */ }
    }
  } catch (e) {
    console.error('[emergencyPrune] failed', e);
  }
}

/**
 * Records the real server id once the background create-order POST lands
 * (or once a queued offline order finally syncs). `orderId` never changes
 * for the UI — this is purely so the shipping code for later
 * operations (payment, append-items) on this order knows what id to PUT
 * against, since the server doesn't accept client-supplied ids yet.
 */
export function reconcileServerId(orderId: string, serverId: string) {
  const o = useViews.getState().orders[orderId];
  if (!o) return;
  useViews.getState()._setSnapshot({
    orders: { ...useViews.getState().orders, [orderId]: { ...o, serverId, syncState: 'SYNCED' } },
  });
  // Durable — without this, the mapping only lives in memory and a reload
  // (or Fast Refresh in dev) forgets it. refreshOrders would then treat the
  // next server-list merge as a brand-new order it's never seen, creating a
  // second, duplicate ticket for the same order with the server's own
  // number instead of recognizing it as this one.
  edb.meta.put({ key: `serverId:${orderId}`, value: serverId }).catch(console.error);
}

/**
 * Insert a server order object (the `/api/orders/:id` shape) into the view
 * store so command-driven flows can operate on it — used by the order screen
 * when it loads an order that predates this terminal's view store, so
 * `commands.appendItems` and the outbox have something to work with. Keyed by
 * the server id, with `serverId` set so the outbox ships item appends straight
 * to `PUT /api/orders/:serverId/items` rather than trying to re-create it.
 * Idempotent — returns the store key whether it inserted or found it.
 */
export function seedServerOrder(raw: any): string {
  if (!raw?.id) return '';
  const cur = useViews.getState().orders;
  for (const [localId, o] of Object.entries(cur)) {
    if (localId === raw.id || o.serverId === raw.id) return localId;
  }
  const mapped = { ...mapServerOrderToView(raw), serverId: raw.id, syncState: 'SYNCED' as any };
  useViews.getState()._setSnapshot({ orders: { ...cur, [raw.id]: mapped } });
  return raw.id;
}

/**
 * Seeds table view state from the existing floor-plan endpoint (same one
 * hooks/useSWRTables.ts and ClientTableMap.tsx already use). Without this,
 * useViews.tables starts empty and every ORDER_SENT_TO_KITCHEN/
 * PAYMENT_COLLECTED reducer's table lookup silently no-ops — the reducers
 * only ever *update* a table already present in the map, they don't create
 * one, since a table's identity/floor-plan geometry is reference data, not
 * something an order event should be inventing.
 */
export async function seedTablesFromServer(branchId: string): Promise<void> {
  try {
    const { getToken } = await import('@/lib/pos-session');
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${API_URL}/api/floor-plan/${branchId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const plan = await res.json();
    const raw = Array.isArray(plan) ? plan : plan.tables || [];
    const cur = useViews.getState().tables;
    const map: Record<string, TableView> = {};
    for (const t of raw) {
      // Don't clobber a table that has a locally-pending order attached —
      // the server snapshot may not know about it yet.
      if (cur[t.id]?.activeOrderId) {
        map[t.id] = cur[t.id];
        continue;
      }
      map[t.id] = {
        id: t.id,
        label: t.label,
        status: fromDbTableStatus(t.status),
        isActive: t.isActive ?? true,
        statusOverride: (t.statusOverride as TableStatusOverride) ?? null,
        lastCompletedAt: t.lastCompletedAt ?? null,
        occupiedSince: t.occupiedSince || t.since || null,
        activeOrderId: t.activeOrderId || null,
        floorNumber: t.floorNumber || t.floor || 1,
        capacity: t.capacity || 4,
        shape: t.shape || 'square',
        x: t.positionX ?? t.x ?? 100,
        y: t.positionY ?? t.y ?? 100,
        width: t.width || 88,
        height: t.height || 88,
        assignedWaiterId: t.assignedWaiterId ?? null,
        assignedWaiterName: t.assignedWaiterName ?? null,
        assignedWaiterColor: t.assignedWaiterColor ?? null,
      };
    }
    useViews.getState()._setSnapshot({ tables: map });
  } catch {
    // Best-effort — table view just stays whatever it already was
  }
}

// Maps GET /api/orders/live's actual response shape (order.service.ts's
// listLiveOrders → mapOrder) — confirmed against the real endpoint, not
// guessed: the amount field is `total` (not netAmount/totalAmount/subtotal),
// items carry `name`/`qty` directly (not nested item.name/quantity), the
// short code is `token` (not tokenNumber), and there is NO tableId at all
// on this summary shape (only tableLabel) — a pre-existing limitation of
// this endpoint, not something introduced here (TicketsDashboard's
// tableId-based navigation for a live order already had this gap before
// this conversion).
function mapServerOrderToView(o: any): OrderView {
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const total = Number(o.total ?? o.netAmount ?? o.totalAmount ?? o.subtotal ?? 0);
  return {
    id: o.id,
    serverId: o.id,
    orderNumber: o.orderNumber,
    tokenNumber: o.token ?? o.tokenNumber ?? null,
    type: o.type,
    status: (o.status || 'PENDING') as OrderStatus,
    tableId: o.tableId ?? null,
    tableLabel: o.tableLabel ?? o.table?.label ?? null,
    guestCount: o.guestCount ?? null,
    items: rawItems.map((it: any) => ({
      lineId: it.id ?? `srv_${it.itemId ?? it.name ?? 'item'}_${Math.random().toString(36).slice(2, 8)}`,
      itemId: it.itemId ?? '',
      itemName: it.name ?? it.item?.name ?? it.itemName ?? 'Item',
      variationId: it.options?.variation?.id ?? null,
      variationName: it.variation ?? it.options?.variation?.name ?? null,
      qty: it.qty ?? it.quantity ?? 1,
      unitPrice: it.unitPrice ?? 0,
      note: it.notes ?? null,
      sentToKitchen: true,
      voided: it.status === 'VOIDED',
      addOns: it.options?.addOns ?? [],
    })),
    subtotal: total,
    taxAmount: Number(o.taxAmount ?? 0),
    discountAmount: Number(o.discountAmount ?? 0),
    discountReason: null,
    netAmount: total,
    paymentMethod: o.payments?.[0]?.method ?? null,
    payments: null,
    redeemedPointsAmount: null,
    cashReceived: 0,
    change: 0,
    shiftId: o.shiftId ?? '',
    cashierId: o.cashierId ?? '',
    cashierName: o.cashierName ?? o.cashier?.name ?? '',
    customerId: o.customerId ?? null,
    customerPhone: o.customerPhone ?? null,
    customerName: o.customerName ?? null,
    assignedWaiterId: o.assignedWaiterId ?? null,
    assignedWaiterName: o.assignedWaiterName ?? null,
    billRequestedAt: o.billRequestedAt ?? null,
    notes: o.notes ?? null,
    source: o.source ?? null,
    createdAt: o.createdAt,
    updatedAt: o.completedAt ?? o.updatedAt ?? o.createdAt,
    syncState: 'SYNCED',
    kotPrintedAt: null,
    billPrintedAt: null,
    receiptPrintedAt: null,
    cancellationKotPrintedAt: null,
    voidReason: null,
    walkOutReason: null,
  };
}

/**
 * Hydrates useViews.orders from the server's live-orders list. This is what
 * makes "screens read only from views" safe rather than a regression: the
 * event log by itself only ever knows about orders *this terminal* created
 * this session — nothing from other terminals, nothing from before this
 * session started, and nothing from QR/WhatsApp/aggregator sources (they
 * never go through this terminal's command layer at all). Screens stay
 * fetch-free; this is the one place that fetches, same division of
 * responsibility seedTablesFromServer already established for tables.
 *
 * Orders this terminal has locally but the server doesn't know about yet
 * (still PENDING/no serverId) are preserved rather than dropped by the
 * server's list.
 *
 * `opts.shiftId` scopes the board to one shift (spec Part 2). A cashier
 * passes their open shift so they never see another terminal's cart or a
 * previous shift; the server also enforces this by role.
 */
export async function refreshOrders(
  branchId: string,
  opts?: { shiftId?: string | null },
): Promise<void> {
  try {
    const { getToken } = await import('@/lib/pos-session');
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const qs = new URLSearchParams({ branchId });
    if (opts?.shiftId) qs.set('shiftId', opts.shiftId);
    const res = await fetch(`${API_URL}/api/orders/live?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    const list: any[] = Array.isArray(json.orders) ? json.orders : Array.isArray(json) ? json : [];

    const cur = useViews.getState().orders;
    const bySeverId = new Map<string, string>(); // serverId -> local orderId, for locally-created orders already reconciled
    for (const [localId, o] of Object.entries(cur)) {
      if (o.serverId) bySeverId.set(o.serverId, localId);
    }

    const merged: Record<string, OrderView> = {};
    // Keep every locally-known order not yet confirmed by the server list
    // (brand new, still in flight) exactly as-is.
    for (const [localId, o] of Object.entries(cur)) {
      if (!o.serverId) merged[localId] = o;
    }
    for (const raw of list) {
      const localId = bySeverId.get(raw.id);
      const existing = localId ? cur[localId] : undefined;
      // GET /api/orders/live only ever returns PENDING/IN_KITCHEN/READY
      // orders. If this terminal already marked the same order COMPLETED
      // (or CANCELLED/VOIDED/WALKED_OUT) locally — e.g. it just collected
      // payment and the outbox's PUT is still in flight to the server —
      // this list entry is stale by definition, not newer truth. Letting it
      // overwrite the local terminal status is exactly why a completed
      // order flickers back onto Tickets for a few seconds before the real
      // PUT confirms and it disappears again.
      if (existing && TERMINAL_ORDER_STATUSES.has(existing.status)) {
        merged[localId!] = existing;
        continue;
      }
      const mapped = mapServerOrderToView(raw);
      // A locally-created order keeps its permanent client-owned id and
      // order number forever — this merge only exists to pick up
      // server-side truth (status changes from elsewhere, tax, etc.) for an
      // order this terminal already knows about. Without this, the very
      // next background refresh after creating an order silently swaps its
      // permanent number for the server's, which is the exact bug this
      // whole event-sourced order-number design exists to prevent.
      merged[localId ?? raw.id] = existing
        ? { ...mapped, id: existing.id, orderNumber: existing.orderNumber, tokenNumber: existing.tokenNumber }
        : mapped;
    }
    useViews.getState()._setSnapshot({ orders: merged });
  } catch {
    // Best-effort — orders view just stays whatever it already was
  }
}
