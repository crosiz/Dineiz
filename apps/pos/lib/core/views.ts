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
  status: 'PENDING' | 'IN_KITCHEN' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'VOIDED';
  tableId: string | null;
  tableLabel: string | null;
  items: OrderViewItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paymentMethod: string | null;
  cashReceived: number;
  change: number;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  syncState: 'SYNCED' | 'PENDING' | 'DEGRADED' | 'POISONED';
  kotPrintedAt: string | null;
}

export interface TableView {
  id: string;
  label: string;
  status: 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'DIRTY' | 'RESERVED';
  occupiedSince: string | null;
  activeOrderId: string | null;
  floorNumber: number;
}

interface ViewStore {
  orders: Record<string, OrderView>;
  tables: Record<string, TableView>;
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
  isReady: false,

  _applyEvent: (e) => set((state) => reduce(state, e)),
  _setSnapshot: (partial) => set(partial),
  _markReady: () => set({ isReady: true }),
}));

// ─── THE REDUCER: pure function, event → new state ──────────────────────────

function reduce(state: ViewStore, e: PosEvent): Partial<ViewStore> {
  const orders = { ...state.orders };
  const tables = { ...state.tables };

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
        items: [],
        subtotal: 0, taxAmount: 0, discountAmount: 0, netAmount: 0,
        paymentMethod: null, cashReceived: 0, change: 0,
        shiftId: e.shiftId,
        cashierId: e.actorId,
        cashierName: e.actorName,
        customerPhone: e.payload.customerPhone ?? null,
        notes: e.payload.notes ?? null,
        createdAt: e.clientTime,
        updatedAt: e.clientTime,
        syncState: 'PENDING',
        kotPrintedAt: null,
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
    case 'DISCOUNT_APPLIED': {
      const o = orders[e.aggregateId];
      if (!o) break;
      orders[e.aggregateId] = { ...o, discountAmount: e.payload.amount, updatedAt: e.clientTime };
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
      const o = orders[e.aggregateId];
      if (o) orders[e.aggregateId] = { ...o, status: 'READY', updatedAt: e.clientTime };
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
        updatedAt: e.clientTime,
      };
      if (o.tableId && tables[o.tableId]) {
        tables[o.tableId] = { ...tables[o.tableId], status: 'FREE', occupiedSince: null, activeOrderId: null };
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
    case 'KOT_PRINTED': {
      const o = orders[e.aggregateId];
      if (o) orders[e.aggregateId] = { ...o, kotPrintedAt: e.clientTime };
      break;
    }
  }

  return { orders, tables };
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
      };
    }
    useViews.getState()._setSnapshot({ tables: map });
  } catch {
    // Best-effort — table view just stays whatever it already was
  }
}
