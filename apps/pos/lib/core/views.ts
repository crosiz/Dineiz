import { create } from 'zustand';
import { edb, type PosEvent } from './event-log';

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
}

export type OrderStatus =
  | 'PENDING' | 'IN_KITCHEN' | 'READY' | 'SERVED' | 'COMPLETED'
  | 'CANCELLED' | 'VOIDED' | 'WALKED_OUT';

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
  status: 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'DIRTY' | 'RESERVED';
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

  _applyEvent: (e) => set((state) => reduce(state, e)),
  _setSnapshot: (partial) => set(partial),
  _markReady: () => set({ isReady: true }),
}));

// ─── THE REDUCER: pure function, event → new state ──────────────────────────

function reduce(state: ViewStore, e: PosEvent): Partial<ViewStore> {
  const orders = { ...state.orders };
  const tables = { ...state.tables };
  let shift = state.shift;

  const patchOrder = (patch: Partial<OrderView>) => {
    const o = orders[e.aggregateId];
    if (!o) return;
    orders[e.aggregateId] = { ...o, ...patch, updatedAt: e.clientTime };
  };
  const freeTable = (tableId: string | null, status: TableView['status'] = 'FREE') => {
    if (!tableId || !tables[tableId]) return;
    tables[tableId] = { ...tables[tableId], status, occupiedSince: null, activeOrderId: null };
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
        paymentMethod: null, cashReceived: 0, change: 0,
        shiftId: e.shiftId,
        cashierId: e.actorId,
        cashierName: e.actorName,
        customerId: null,
        customerPhone: e.payload.customerPhone ?? null,
        customerName: null,
        assignedWaiterId: null,
        assignedWaiterName: null,
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
      if (o.tableId && tables[o.tableId]) {
        tables[o.tableId] = {
          ...tables[o.tableId],
          status: 'OCCUPIED',
          occupiedSince: tables[o.tableId].occupiedSince ?? e.clientTime,
          activeOrderId: o.id,
        };
      }
      break;
    }
    case 'ORDER_MARKED_READY': {
      patchOrder({ status: 'READY' });
      break;
    }
    case 'ORDER_SERVED': {
      patchOrder({ status: 'SERVED' });
      break;
    }
    case 'PAYMENT_COLLECTED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o,
        status: 'COMPLETED',
        paymentMethod: e.payload.method,
        cashReceived: e.payload.cashReceived ?? 0,
        change: e.payload.change ?? 0,
        taxAmount: e.payload.taxAmount ?? o.taxAmount,
        netAmount: e.payload.total ?? o.netAmount,
        updatedAt: e.clientTime,
      };
      if (o.tableId && tables[o.tableId]) {
        tables[o.tableId] = { ...tables[o.tableId], status: 'DIRTY', occupiedSince: null, activeOrderId: null };
      }
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
      freeTable(o.tableId);
      break;
    }
    case 'ORDER_WALKED_OUT': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = {
        ...o, status: 'WALKED_OUT', walkOutReason: e.payload?.reason ?? null, updatedAt: e.clientTime,
      };
      freeTable(o.tableId);
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
      freeTable(o.tableId, 'FREE');
      const newTableId = e.payload.toTableId;
      orders[e.aggregateId] = { ...o, tableId: newTableId, tableLabel: e.payload.toTableLabel ?? o.tableLabel, updatedAt: e.clientTime };
      if (newTableId && tables[newTableId]) {
        tables[newTableId] = { ...tables[newTableId], status: 'OCCUPIED', activeOrderId: o.id, occupiedSince: tables[newTableId].occupiedSince ?? e.clientTime };
      }
      break;
    }
    case 'TABLE_STATUS_CHANGED': {
      const t = tables[e.aggregateId];
      if (!t) break;
      tables[e.aggregateId] = {
        ...t,
        status: e.payload.status,
        occupiedSince: e.payload.status === 'OCCUPIED' ? (t.occupiedSince ?? e.clientTime) : null,
      };
      break;
    }
    case 'TABLE_MERGED': {
      // Fold the source table's occupancy into the destination; the source
      // itself goes free (its physical seats are still there, just no
      // longer tracking a separate order).
      const from = tables[e.aggregateId];
      const into = tables[e.payload.intoTableId];
      if (from && into) {
        tables[e.payload.intoTableId] = {
          ...into,
          status: from.status !== 'FREE' ? from.status : into.status,
          activeOrderId: into.activeOrderId ?? from.activeOrderId,
          occupiedSince: into.occupiedSince ?? from.occupiedSince,
        };
        tables[e.aggregateId] = { ...from, status: 'FREE', occupiedSince: null, activeOrderId: null };
      }
      break;
    }
    case 'TABLE_SPLIT': {
      // Source table stays as-is; newly split-off tables start FREE — this
      // terminal doesn't try to guess seat/order allocation, that's a
      // follow-up TABLE_STATUS_CHANGED / ORDER_MOVED_TO_TABLE per new table.
      for (const newTableId of e.payload.newTableIds ?? []) {
        if (tables[newTableId]) {
          tables[newTableId] = { ...tables[newTableId], status: 'FREE', occupiedSince: null, activeOrderId: null };
        }
      }
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

  return { orders, tables, shift };
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
        status: (t.status || 'FREE').toUpperCase(),
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
    })),
    subtotal: total,
    taxAmount: Number(o.taxAmount ?? 0),
    discountAmount: Number(o.discountAmount ?? 0),
    discountReason: null,
    netAmount: total,
    paymentMethod: o.payments?.[0]?.method ?? null,
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
 */
export async function refreshOrders(branchId: string): Promise<void> {
  try {
    const { getToken } = await import('@/lib/pos-session');
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${API_URL}/api/orders/live?branchId=${branchId}`, {
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
