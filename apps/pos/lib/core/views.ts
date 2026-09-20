import { create } from 'zustand';
import { edb, type PosEvent } from './event-log';
import {
  deriveTableStatus,
  fromDbTableStatus,
  type DerivedTableStatus,
  type TableStatusOverride,
} from '@dineiz/schemas';
import { API_URL } from '@/lib/api';
import { computeTotals, resolveTaxConfig } from '@/lib/pricing';
import { useBrandingStore } from '@/lib/branding-store';
import { getPosSession } from '@/lib/pos-session';
import { resolveShiftId } from '@/lib/offline-shift';

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
  // Reactive store, not a hand-rolled localStorage parse — the branding store
  // is the single source and it stays in sync with live admin pushes.
  const b = useBrandingStore.getState().branding as any;
  const m = Number(b?.tableCleaningMinutes ?? b?.pos?.tableCleaningMinutes);
  return Number.isFinite(m) && m >= 0 ? m : 5;
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
        // Through the alias: a shift opened offline may have joined one the
        // server already had (lib/offline-shift.ts).
        shiftId: resolveShiftId(e.shiftId),
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
      patchOrder({ shiftId: e.payload.intoShiftId ?? resolveShiftId(e.shiftId) });
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
      // Clearing the override to "free" also means the table is clean: drop
      // the cleaning-timer anchor so the derivation can actually reach FREE.
      // Without this, clearing an override on a recently-paid table re-derived
      // straight back to DIRTY and looked like nothing happened.
      const clearingToFree = override === null && (raw === 'FREE' || raw === 'AVAILABLE' || raw === 'CLEAN' || raw === '');
      tables[e.aggregateId] = {
        ...t,
        statusOverride: override,
        ...(clearingToFree ? { lastCompletedAt: null } : {}),
      };
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
    occupiedSince: busy ? (t.occupiedSince ?? onTable.find(o => ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'].includes(o.status))?.createdAt ?? new Date(now).toISOString()) : null,
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

/**
 * Re-derive an order's money from its live lines.
 *
 * This is the figure that actually reaches the database — `createOrderBody`
 * ships this `taxAmount`/`netAmount`, and `collectPaymentBody` bills this
 * `netAmount`. It used to do its own arithmetic: always the cash rate, the
 * enabled flags ignored entirely, `pos_branding` re-parsed out of localStorage
 * on every single item add and only at the top level (so a rate delivered under
 * `branding.pos.*` silently fell back to a hardcoded 5%). The cart could show
 * one total and the server receive another, and a tenant with tax switched off
 * was charged anyway.
 *
 * Now the same `computeTotals` the cart uses, off the same reactive branding
 * store the rest of the app reads ([[architecture/settings-persistence]]'s
 * rule — no component parses `pos_branding` by hand).
 *
 * `paymentMethod` is only known once a payment is collected; before that an
 * order is priced at the cash rate, which is what the kitchen ticket and the
 * pre-payment bill both assume.
 */
function recalc(orders: Record<string, OrderView>, orderId: string) {
  const o = orders[orderId];
  if (!o) return;
  const active = o.items.filter((i) => !i.voided);
  const subtotal = active.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const totals = computeTotals({
    subtotal,
    discount: o.discountAmount,
    method: o.paymentMethod ?? 'CASH',
    config: resolveTaxConfig(useBrandingStore.getState().branding),
  });
  orders[orderId] = {
    ...o,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    netAmount: totals.total,
  };
}

// ─── REBUILD: replay all events on cold start ───────────────────────────────

export async function rebuildViews(): Promise<void> {
  // The floor plan is reference data fetched from the server. A tablet that
  // cold-starts with no network used to come up with an empty Tables screen:
  // the only persisted copy lived in the 'snapshot', which is taken only on a
  // manual compact. The last floor plan seen is now kept on its own (see
  // persistFloorPlan) and restored first; a snapshot, when there is one, still
  // wins because it is at least as new.
  const floor = await edb.views.get(FLOOR_PLAN_KEY);
  if (floor?.value?.branchId && floor.value.branchId === currentBranchId()) {
    useViews.getState()._setSnapshot({ tables: floor.value.tables });
  }
  const referenceKey = serverOrdersCacheKey();
  const referenceOrders = referenceKey ? await edb.views.get(referenceKey) : null;
  if (referenceOrders) useViews.getState()._setSnapshot({ orders: referenceOrders.value });
  const snapshot = await edb.views.get('snapshot');
  if (snapshot) {
    useViews.getState()._setSnapshot(snapshot.value);
  }
  // Server-origin orders have no ORDER_CREATED event on this device. Restore
  // their durable starting point before replaying a payment or item change.
  const basePrefix = orderReplayPrefix();
  const orderBases = basePrefix ? await edb.views.where('key').startsWith(basePrefix).toArray() : [];
  const baseVersions = new Map<string, number>();
  const restoredOrders = { ...useViews.getState().orders };
  for (const base of orderBases) {
    const order = base.value as OrderView;
    if (snapshot?.value?.orders?.[order.id] && snapshot.version >= base.version) continue;
    restoredOrders[order.id] = order;
    baseVersions.set(order.id, base.version);
  }
  useViews.getState()._setSnapshot({ orders: restoredOrders });
  const lastSeq = snapshot?.version ?? 0;
  const replayFrom = Math.min(lastSeq, ...Array.from(baseVersions.values()));
  const events = await edb.events.where('seq').above(replayFrom).sortBy('seq');
  const apply = useViews.getState()._applyEvent;
  // SUPERSEDED = "this event is void, act as if it never happened" — both for a
  // stale duplicate the outbox collapsed AND for a poisoned event an operator
  // dismissed (outbox.discardStuckEvent). Skipping it here is what makes
  // dismissing a rejected PKR-0 / half-total payment actually put the order
  // back on the board instead of leaving it "paid" locally forever.
  for (const e of events) {
    if (e.syncState !== 'SUPERSEDED' && e.seq > (baseVersions.get(e.aggregateId) ?? lastSeq)) apply(e);
  }

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

  // Restored tables carry whatever status they had when saved; derive it
  // from the orders this terminal actually has now.
  if (Object.keys(useViews.getState().tables).length > 0) reconcileTables();

  useViews.getState()._markReady();
}

function orderReplayPrefix(): string | null {
  const session = getPosSession();
  return session ? `orderBase:${session.tenantId}:${session.branchId}:` : null;
}

function serverOrdersCacheKey(): string | null {
  const session = getPosSession();
  return session ? `serverOrders:${session.tenantId}:${session.branchId}:${session.userId}` : null;
}

/** Must finish before a server-origin order's first local mutation is saved. */
export async function ensureOrderReplayBase(order: OrderView): Promise<void> {
  const prefix = orderReplayPrefix();
  if (!prefix || !order.serverId || order.id !== order.serverId) return;
  const key = prefix + order.id;
  await edb.transaction('rw', edb.views, edb.events, async () => {
    if (await edb.views.get(key)) return;
    const previous = await edb.events.where('aggregateId').equals(order.id).sortBy('seq');
    await edb.views.put({ key, value: order, version: previous.at(-1)?.seq ?? 0 });
  });
}

// ─── FLOOR PLAN CACHE: tables survive a cold start with no network ─────────

const FLOOR_PLAN_KEY = 'floorPlan';

function currentBranchId(): string | null {
  try {
    return getPosSession()?.branchId ?? null;
  } catch {
    return null;
  }
}

async function persistFloorPlan(branchId: string, tables: Record<string, TableView>): Promise<void> {
  try {
    await edb.views.put({ key: FLOOR_PLAN_KEY, value: { branchId, tables }, version: 0 });
  } catch {
    // Storage full or unavailable. The live copy in memory is unaffected.
  }
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
/**
 * Map an order id that may be EITHER this terminal's client id or the
 * server's id onto the view store's key.
 *
 * Every command in commands.ts addresses an order by the store's key, because
 * that's what the reducer looks up (`orders[e.aggregateId]`). But plenty of
 * call sites only have the server's id — anything that loaded the order over
 * HTTP rather than out of the store (ClientTableMap's `fetchActiveOrder`, a
 * deep link with `?orderId=`, the order-history list). Passing one of those
 * straight to a command made the reducer's lookup miss and the event a silent
 * no-op: payment collected, nothing happened — the order stayed on the board
 * and the table never updated.
 *
 * Returns the input unchanged when nothing matches, so a brand-new order id
 * (or an order this terminal genuinely doesn't know) behaves as before.
 */
export function resolveLocalOrderId(id: string): string {
  if (!id) return id;
  const orders = useViews.getState().orders;
  if (orders[id]) return id;
  for (const [localId, o] of Object.entries(orders)) {
    if (o.serverId === id) return localId;
  }
  return id;
}

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
// Callers that legitimately overlap: POSLayout's bootstrap, ClientTableMap's
// own mount, the table:status_changed socket handler, and a reconnect resync —
// which on a single visit to the Tables screen produced four identical
// GET /api/floor-plan requests. Share one in-flight promise per branch instead;
// a caller that arrives while a fetch is running awaits the same result.
const inflightTableSeeds = new Map<string, Promise<void>>();

export function seedTablesFromServer(branchId: string): Promise<void> {
  const existing = inflightTableSeeds.get(branchId);
  if (existing) return existing;
  const p = doSeedTablesFromServer(branchId).finally(() => {
    inflightTableSeeds.delete(branchId);
  });
  inflightTableSeeds.set(branchId, p);
  return p;
}

async function doSeedTablesFromServer(branchId: string): Promise<void> {
  try {
    const { getToken } = await import('@/lib/pos-session');
    const res = await fetch(`${API_URL}/api/floor-plan/${branchId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const plan = await res.json();
    const raw = Array.isArray(plan) ? plan : plan.tables || [];
    if (!Array.isArray(raw) || raw.length === 0) return; // empty/garbage response — keep what we have

    const cur = useViews.getState().tables;
    const map: Record<string, TableView> = { ...cur }; // never drop a table we already know

    for (const t of raw) {
      const local = cur[t.id];
      // Geometry / label / waiter are reference data — always take the server's.
      // status / activeOrderId / occupiedSince / lastCompletedAt are DERIVED
      // from orders and are the reducer's to own (spec Part 3). Only trust the
      // server's for a table this terminal has never seen — otherwise a table
      // held OCCUPIED by a locally-punched order that hasn't synced yet would
      // get wiped to FREE the next time the floor plan is fetched.
      //
      // statusOverride is the one exception: it's a manager decision
      // (RESERVED/INACTIVE/MERGED), never order-derived, so there is no local
      // reducer that could ever set it for a change made on ANOTHER terminal
      // (or the dashboard) — only this fetch can. Keeping it out of this
      // branch meant a reservation set after a terminal had already loaded a
      // table was invisible on that terminal forever, no matter how many
      // times it reconnected or refetched: reconcileTables() below re-derives
      // `status` from this same field, so the stale override silently won
      // every time. Always take the server's; reconcileTables() then
      // re-derives `status` from it plus this terminal's own local orders, so
      // an order genuinely in flight locally still outranks a stale override.
      map[t.id] = local
        ? {
            ...local,
            label: t.label ?? local.label,
            isActive: t.isActive ?? local.isActive,
            floorNumber: t.floorNumber || t.floor || local.floorNumber,
            capacity: t.capacity || local.capacity,
            shape: t.shape || local.shape,
            x: t.positionX ?? t.x ?? local.x,
            y: t.positionY ?? t.y ?? local.y,
            width: t.width || local.width,
            height: t.height || local.height,
            assignedWaiterId: t.assignedWaiterId ?? local.assignedWaiterId ?? null,
            assignedWaiterName: t.assignedWaiterName ?? local.assignedWaiterName ?? null,
            assignedWaiterColor: t.assignedWaiterColor ?? local.assignedWaiterColor ?? null,
            statusOverride: (t.statusOverride as TableStatusOverride) ?? null,
          }
        : {
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
    // Re-derive every table from the orders currently in the store so status
    // reflects local reality straight away.
    reconcileTables();
    void persistFloorPlan(branchId, useViews.getState().tables);
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
  // `total` is this endpoint's only order-level amount field, and it's
  // tax-inclusive (order.service.ts's mapOrder sends `total: o.netAmount`) —
  // there is no separate pre-tax subtotal in this response shape. Using it
  // for BOTH `subtotal` and `netAmount` below used to make this order's
  // pre-tax total (OrderDetailsModal's own "Total" line) come out equal to
  // its final tax-inclusive amount for any order rebuilt from a live-orders
  // pull (every page reload/reconnect/socket refresh, not just a one-off).
  // Each line item's own `subtotal` IS present on this response, though
  // (mapOrder: `subtotal: it.subtotal ?? unitPrice*quantity`) — summing
  // those gives the real pre-tax figure without needing a server change.
  const total = Number(o.total ?? o.netAmount ?? o.totalAmount ?? o.subtotal ?? 0);
  const computedSubtotal = rawItems.reduce(
    (sum: number, it: any) => sum + (Number(it.subtotal) || (Number(it.unitPrice) || 0) * (Number(it.qty ?? it.quantity) || 1)),
    0,
  );
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
    subtotal: computedSubtotal,
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
    // Order numbers are client-owned and unique per tenant (@@unique on
    // [tenantId, orderNumber]; the server inserts ours verbatim), so they are
    // the ONE identifier both sides always agree on. Matching on serverId
    // alone left a race: if a socket-driven refresh ran between the create
    // POST landing and reconcileServerId applying, the local row still had
    // serverId=null, so the same order was ALSO inserted under the server's
    // id — one punch, two tickets, and the duplicate stuck permanently
    // because from then on it matched itself. Matching on the number closes
    // the window regardless of reconcile timing.
    const byNumber = new Map<string, string>();
    for (const [localId, o] of Object.entries(cur)) {
      if (o.serverId) bySeverId.set(o.serverId, localId);
      // Prefer the client-created row (it owns the permanent id/number) if a
      // duplicate from the old behaviour is still sitting in the store.
      if (o.orderNumber && (!byNumber.has(o.orderNumber) || localId !== o.serverId)) {
        byNumber.set(o.orderNumber, localId);
      }
    }

    const merged: Record<string, OrderView> = {};
    // Keep every locally-known order not yet confirmed by the server list
    // (brand new, still in flight) exactly as-is — unless it's a stale
    // server-keyed duplicate of a client-created row we're about to re-add.
    // Orders this terminal finished (paid, cancelled) stay too, for a day and
    // a half. The live list never contains them, so they used to be dropped
    // here as soon as the server had them: Home's "Orders paid / Sales",
    // which counts this shift's completed orders on this terminal, fell back
    // every few seconds and waited on the server's figure instead, which is
    // exactly the delay the local count exists to avoid.
    const keepFinishedSince = Date.now() - 36 * 60 * 60 * 1000;
    for (const [localId, o] of Object.entries(cur)) {
      const finishedHere = TERMINAL_ORDER_STATUSES.has(o.status) && Date.parse(o.createdAt) >= keepFinishedSince;
      if (o.serverId && !finishedHere) continue;
      if (o.orderNumber && byNumber.get(o.orderNumber) !== localId) continue;
      merged[localId] = o;
    }
    for (const raw of list) {
      const localId = bySeverId.get(raw.id) ?? (raw.orderNumber ? byNumber.get(raw.orderNumber) : undefined);
      const existing = localId ? cur[localId] : undefined;
      // Matched by number but the local row never got its serverId (the race
      // above) — heal it now so every later lookup, and the outbox, resolve
      // against the real id instead of trying to create the order again.
      if (existing && !existing.serverId && localId && localId !== raw.id) {
        reconcileServerId(localId, raw.id);
      }
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
      //
      // `tableId` / `tableLabel` are ALSO preserved from the local row:
      // GET /api/orders/live's summary shape carries `tableLabel` but no
      // `tableId`, so `mapped.tableId` is null — letting it through wiped the
      // table link the ORDER_CREATED event set, and the table's derived status
      // dropped back to FREE a second after the order was punched (table not
      // turning red / freeing wrongly). The server list never knows a table
      // better than the terminal that opened the order.
      const preservedTableId = existing?.tableId ?? mapped.tableId;
      const preservedTableLabel = existing?.tableLabel ?? mapped.tableLabel;
      // `shiftId` too — the live list omitted it, so `mapped.shiftId` was ''
      // and a locally-created order lost the shift stamp it needs to be counted
      // in the POS home's local "orders served / total value".
      const preservedShiftId = existing?.shiftId || mapped.shiftId || '';
      merged[localId ?? raw.id] = existing
        ? {
            ...mapped,
            id: existing.id,
            serverId: raw.id,
            orderNumber: existing.orderNumber,
            tokenNumber: existing.tokenNumber,
            tableId: preservedTableId,
            tableLabel: preservedTableLabel,
            shiftId: preservedShiftId,
          }
        : mapped;
    }

    // Belt and braces: never hand the UI two rows with the same order number.
    // Any that slipped in before this fix (they persist in the store across a
    // whole session) are collapsed onto the client-created row, which owns the
    // permanent id and number.
    const seen = new Map<string, string>();
    for (const [id, o] of Object.entries(merged)) {
      if (!o.orderNumber) continue;
      const keptId = seen.get(o.orderNumber);
      if (keptId === undefined) { seen.set(o.orderNumber, id); continue; }
      // Two rows, same client-owned order number. Keep the one whose key is NOT
      // its own server id (the client-created row — it owns the id + number).
      const keepId = o.serverId === id ? keptId : id;
      const dropId = keepId === id ? keptId : id;
      const keep = merged[keepId];
      const drop = merged[dropId];
      // ...but if the kept row is missing its money (a botched local create, or
      // a row hydrated before the API sent line prices), adopt the other row's
      // items + totals wholesale so the table popup / checkout don't read
      // "Rs. 0" and a payment isn't blocked as "nothing to charge".
      const keepMoneyless =
        (keep?.netAmount ?? 0) <= 0 &&
        (keep?.items ?? []).reduce((s, i) => s + (i.unitPrice ?? 0) * (i.qty ?? 0), 0) <= 0;
      if (keep && drop && keepMoneyless && (drop.netAmount ?? 0) > 0) {
        merged[keepId] = {
          ...keep,
          items: drop.items?.length ? drop.items : keep.items,
          subtotal: drop.subtotal,
          taxAmount: drop.taxAmount,
          discountAmount: drop.discountAmount,
          netAmount: drop.netAmount,
        };
      }
      delete merged[dropId];
      seen.set(o.orderNumber, keepId);
    }

    // Keep the latest server-only reference orders for an offline cold start.
    // Client-created orders are rebuilt from their own events, never duplicated
    // under the server ID. Immutable replay bases preserve local modifications.
    const referenceKey = serverOrdersCacheKey();
    if (referenceKey) {
      const reference: Record<string, OrderView> = {};
      for (const raw of list) {
        const localId = bySeverId.get(raw.id) ?? (raw.orderNumber ? byNumber.get(raw.orderNumber) : undefined);
        if (!localId || localId === raw.id) reference[raw.id] = mapServerOrderToView(raw);
      }
      await edb.views.put({ key: referenceKey, value: reference, version: 0 }).catch(() => {});
    }
    useViews.getState()._setSnapshot({ orders: merged });
    // Recover older installations that saved a payment but not its imported
    // order. This restores the local projection only; it never changes server
    // records or fabricates a confirmation. Rejections remain review blockers.
    const session = getPosSession();
    const savedPayments = await edb.events.where('type').equals('PAYMENT_COLLECTED')
      .filter(e => e.branchId === session?.branchId && e.tenantId === session?.tenantId &&
        !['SUPERSEDED', 'CONFIRMED'].includes(e.syncState)).sortBy('seq');
    for (const payment of savedPayments) {
      const order = useViews.getState().orders[payment.aggregateId];
      if (!order || TERMINAL_ORDER_STATUSES.has(order.status) ||
          !(Number(payment.payload.total) > 0) || Number(payment.payload.total) + 0.01 < order.netAmount) continue;
      const prefix = orderReplayPrefix();
      if (prefix) await edb.transaction('rw', edb.views, async () => {
        const key = prefix + order.id;
        if (!await edb.views.get(key)) await edb.views.put({ key, value: order, version: payment.seq - 1 });
      });
      useViews.getState()._applyEvent(payment);
    }
    reconcileTables();
  } catch {
    // Best-effort — orders view just stays whatever it already was
  }
}
