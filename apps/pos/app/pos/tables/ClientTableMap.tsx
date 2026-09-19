'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AssignWaiterSheet } from './AssignWaiterSheet';
import { PremiumTable, getTableDimensions, CHAIR_PAD } from '@/components/PremiumTable';
import { TABLE_TONE } from '@/lib/table-tone';
import PaymentModal from '@/components/PaymentModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { useSocket } from '@/contexts/SocketContext';
import { getToken, getPosSession } from '@/lib/pos-session';
import { useCartStore } from '@/lib/store';
import { getDB } from '@/lib/db';
import { toast } from 'sonner';
import { useTopBar } from '@/hooks/useTopBar';
import { useViews, seedTablesFromServer, type TableView } from '@/lib/core/views';
import { setTableStatus, markTableCleaned } from '@/lib/core/commands';
import { isViewMode } from '@/lib/view-mode';
import { formatPKR } from '@/lib/utils';
import { ServiceIllustration } from '@/components/ServiceIllustration';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Users,
  Printer,
  CreditCard,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Sparkles,
  Layers,
  Map as MapIcon,
  Rows3,
  Search,
  User,
  UserPlus,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { useScreenSize } from '@/lib/use-screen-size';
import { TableListView } from './TableListView';

const MIN_ZOOM = 0.3;
// Below this a table stops being readable or reliably tappable on a phone — see
// computeFit. 0.8 keeps an 88px table at ~70px with a ~13px label.
const MIN_FIT_ZOOM_NARROW = 0.8;
const MAX_ZOOM = 2.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));


interface TableData {
  id: string;
  label: string;
  capacity: number;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: string;
  floor: number;
  occupiedSince?: string | number | Date | null;
  assignedWaiterId?: string | null;
  assignedWaiterName?: string | null;
  assignedWaiterColor?: string | null;
}

// Adapt an event-store OrderView into the shape the occupied-table popup and
// the checkout modal read (server-order shape). Used so the popup can paint
// straight from useViews instead of waiting on GET /api/orders?tableId=.
function popupFromView(o: any) {
  const items = (o.items || [])
    .filter((i: any) => !i.voided)
    .map((i: any) => ({
      quantity: i.qty ?? i.quantity ?? 1,
      name: i.itemName ?? i.name,
      unitPrice: i.unitPrice ?? 0,
      subtotal: i.subtotal ?? (i.unitPrice ?? 0) * (i.qty ?? i.quantity ?? 1),
      notes: i.note ?? null,
    }));
  const subtotal = items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
  // `??` binds looser than `+`/`-`, and only falls through on null/undefined —
  // a stored `netAmount` of 0 (a local order whose recalc hasn't run, or a row
  // hydrated before the API sent line prices) would win and show "Rs. 0".
  // Take the first POSITIVE of netAmount / total / items-derived.
  const derived = subtotal > 0 ? subtotal + (o.taxAmount ?? 0) - (o.discountAmount ?? 0) : 0;
  const total =
    Number(o.netAmount) > 0 ? Number(o.netAmount)
    : Number(o.total) > 0 ? Number(o.total)
    : Number(o.totalAmount) > 0 ? Number(o.totalAmount)
    : derived;
  return {
    id: o.serverId || o.id,
    orderNumber: o.orderNumber,
    type: o.type,
    status: o.status,
    items,
    subtotal,
    subtotalAmount: subtotal,
    discountAmount: o.discountAmount ?? 0,
    taxAmount: o.taxAmount ?? 0,
    netAmount: total,
    total,
    totalAmount: total,
    assignedWaiterId: o.assignedWaiterId ?? null,
    assignedWaiterName: o.assignedWaiterName ?? null,
    customerId: o.customerId ?? null,
    createdAt: o.createdAt ?? null,
    paymentMethod: o.paymentMethod ?? 'PENDING',
  };
}

export default function ClientTableMap() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const branchId = session.branchId || getPosSession()?.branchId || '';

  const { socket } = useSocket();

  // Phase 2: floor & table state reads from the shared event-derived store
  // (lib/core/views.ts) instead of its own fetch+cache — the same store
  // HomeDashboard's mini floor-plan now reads from too, so a table freed
  // here shows up there instantly and vice versa, with no fetch either way.
  const viewTables = useViews((s) => s.tables);
  const tables: TableData[] = useMemo(
    () => Object.values(viewTables).map((t) => ({
      id: t.id, label: t.label, capacity: t.capacity, shape: t.shape,
      x: t.x, y: t.y, width: t.width, height: t.height,
      status: t.status, floor: t.floorNumber,
      occupiedSince: t.occupiedSince,
      assignedWaiterId: t.assignedWaiterId,
      assignedWaiterName: t.assignedWaiterName,
      assignedWaiterColor: t.assignedWaiterColor,
    })),
    [viewTables]
  );
  const floors = useMemo(() => {
    const extracted = Array.from(new Set(tables.map((t) => t.floor || 1))).sort((a, b) => a - b);
    return extracted.length > 0 ? extracted : [1];
  }, [tables]);
  // Defaults to the FIRST floor that exists, not a hardcoded 1 — a branch whose
  // floors are numbered 2 and 3 opened onto an empty canvas.
  const [activeFloor, setActiveFloor] = useState<number>(floors[0] ?? 1);
  useEffect(() => {
    if (!floors.includes(activeFloor)) setActiveFloor(floors[0] ?? 1);
  }, [floors, activeFloor]);

  const { isMobile: isNarrow } = useScreenSize();

  // Cards default on phones; the spatial plan defaults on wider terminals.
  // Remember the phone preference without shrinking table labels to fit.
  const [narrowView, setNarrowView] = useState<'plan' | 'list'>('list');
  const [wideView, setWideView] = useState<'plan' | 'list'>('plan');
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const showList = isNarrow ? narrowView === 'list' : wideView === 'list';
  useEffect(() => {
    const saved = localStorage.getItem('pos_tables_view');
    if (saved === 'list' || saved === 'plan') setNarrowView(saved);
  }, []);

  // ── Canvas zoom & pan ───────────────────────────────────────────────────
  //
  // `view` maps floor-plan coordinates to screen pixels as `screen = p·zoom + pan`,
  // and the transform below is written `translate(...) scale(...)` to match —
  // CSS applies a transform list right-to-left, so scale runs first and the
  // translate is in *screen* pixels, which is what every consumer here assumes.
  //
  // It used to be `scale(z) translate(panX, panY)`: translate ran FIRST, so the
  // on-screen offset was actually pan×zoom, while the fit code computed pan in
  // screen pixels and getPopupPosition read it back as p·zoom + pan. Three
  // mutually inconsistent coordinate systems. At any zoom ≠ 1 the floor landed
  // in the wrong place — on a phone (54% zoom) half the tables sat off the right
  // edge with empty space above and below — and popups detached from their tables.
  const [view, setView] = useState<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Live gesture state lives in a ref, not React state: a pointermove fires at
  // display rate, and setState per move re-rendered every table on the floor on
  // every frame of a drag.
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    start: { x: number; y: number; view: { zoom: number; x: number; y: number }; dist: number } | null;
  }>({ pointers: new Map(), start: null });
  const rafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ zoom: number; x: number; y: number } | null>(null);

  /** Coalesce gesture updates to one commit per animation frame. */
  const scheduleView = useCallback((next: { zoom: number; x: number; y: number }) => {
    pendingViewRef.current = next;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingViewRef.current) setView(pendingViewRef.current);
    });
  }, []);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // Selected Table & Popups
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [popupOrder, setPopupOrder] = useState<any>(null);
  const [popupLoading, setPopupLoading] = useState<boolean>(false);
  const [popupError, setPopupError] = useState<boolean>(false);
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isAssignWaiterOpen, setIsAssignWaiterOpen] = useState<boolean>(false);


  const tableList = Object.values(viewTables ?? {}) as any[];
  const busyTables = tableList.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
  useTopBar({
    pageTitle: 'Tables',
    breadcrumb: tableList.length ? `${busyTables} of ${tableList.length} busy` : undefined,
    showBackButton: false,
  });

  // Refresh table reference data from the server into the shared store —
  // same function POSLayout.tsx calls at bootstrap and on table:status_changed;
  // called again here on mount so opening this screen doesn't wait on the
  // bootstrap timing, but it's still the shared seeder, not a screen-local
  // fetch. Remote-driven updates (table:status_changed, order:assigned) are
  // now handled centrally in POSLayout.tsx so every screen — not just this
  // one — stays in sync from a single listener.
  useEffect(() => {
    if (branchId) seedTablesFromServer(branchId).catch(console.error);
  }, [branchId]);

  // Keep the selected table's popup live if its underlying view data
  // changes while the popup is open (e.g. another terminal frees it, or a
  // waiter gets assigned) — replaces the old per-socket-event manual patch.
  useEffect(() => {
    if (!selectedTable) return;
    const live = tables.find((t) => t.id === selectedTable.id);
    if (live && (live.status !== selectedTable.status || live.assignedWaiterId !== selectedTable.assignedWaiterId)) {
      setSelectedTable(live);
    }
  }, [tables, selectedTable]);

  // Active order for an occupied table. It's ALWAYS already in the event store
  // — the table only reads OCCUPIED because `deriveTableStatus` found an active
  // order with this `tableId` — so paint from there synchronously, no spinner.
  // The cache + network fetch below only reconcile (waiter changes from another
  // terminal, etc.). This is what removes the "loads the first time" delay.
  const fetchActiveOrder = useCallback(async (tableId: string) => {
    setPopupError(false);

    const vo = Object.values(useViews.getState().orders).find(
      (o) => o.tableId === tableId && ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'].includes(o.status),
    );
    const voPopup = vo ? popupFromView(vo) : null;
    const cacheKey = `table-order-${tableId}`;
    const cached = await getDB().ordersCache.get(cacheKey).catch(() => null);

    // Only trust the local row if it actually has a value — a zero-total view
    // row (stale hydration, missed recalc) should fall through to cache/fetch
    // rather than show "Rs. 0" against a real order.
    if (voPopup && voPopup.total > 0) {
      setPopupOrder(voPopup);
      setPopupLoading(false);
      return; // This terminal's local order includes unsynced changes.
    } else if (cached?.data?.[0]) {
      setPopupOrder(cached.data[0]);
      setPopupLoading(false);
    } else {
      setPopupLoading(true);
      setPopupOrder(null);
    }

    const controller = new AbortController();
    // Generous but bounded — a real fetch failure/hang should still surface an
    // error state rather than hang the popup forever, but 3s was cutting off
    // normal responses under real-world latency and silently showing "no order".
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/orders?tableId=${tableId}&status=PENDING,IN_KITCHEN,READY&limit=1`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const orderData = await res.json();
        const order = orderData.orders?.[0] || orderData.data?.[0] || null;
        setPopupOrder(order);
        if (order) {
          getDB().ordersCache.put({ cacheKey, data: [order], cachedAt: Date.now() }).catch(() => {});
        } else if (!cached?.data?.[0]) {
          // A table marked occupied with genuinely no matching order (and
          // nothing usable in cache) is itself unexpected — surface it
          // instead of silently showing "add items".
          setPopupError(true);
        }
      } else if (!cached?.data?.[0]) {
        setPopupError(true);
      }
    } catch {
      // Real network/timeout failure — only show the error state if we
      // don't already have cached data on screen to fall back on.
      if (!cached?.data?.[0]) setPopupError(true);
    } finally {
      setPopupLoading(false);
    }
  }, []);

  // Table tap handler
  const handleTableTap = (table: TableData) => {
    const status = table.status.toUpperCase();

    if (status === 'FREE' || status === 'AVAILABLE') {
      // Spec Part 11 — starting an order needs an open shift. In View Mode
      // a free table still opens its detail sheet (mark clean/reserved,
      // assign waiter) but can't jump straight into order-building.
      if (isViewMode()) {
        toast.message('Open a shift to take orders', {
          action: { label: 'Open Shift', onClick: () => router.push('/pos/shift/open') },
        });
        setSelectedTable(table);
        return;
      }
      router.push(
        `/pos/order?type=dine-in&tableId=${table.id}&tableLabel=${encodeURIComponent(table.label)}&guests=${table.capacity}`
      );
      return;
    }

    setSelectedTable(table);

    if (status === 'OCCUPIED' || status === 'BILL_REQUESTED' || status === 'READY') {
      fetchActiveOrder(table.id);
    }
  };

  // "Mark as Free" on a table the cashier has just cleared means CLEANED, and
  // that's a different event from a manager override. TABLE_STATUS_CHANGED
  // only clears `statusOverride`; the DIRTY the table is actually showing
  // comes from `lastCompletedAt` (stamped by the payment), which only
  // TABLE_CLEANED resets. Emitting the override event here re-derived the
  // table straight back to DIRTY — the table could never be freed by hand.
  // markTableCleaned clears the anchor, re-derives to FREE, and the outbox
  // ships POST /api/tables/:id/clean with its own retry.
  const handleMarkAsFree = async (tableId: string) => {
    await markTableCleaned(tableId);
    toast.success('Table marked as Free');
    setSelectedTable(null);
  };

  // Handle Print Bill
  const handlePrintBill = async () => {
    if (!selectedTable) return;

    try {
      if (popupOrder) {
        const calculatedSubtotal = popupOrder.subtotalAmount || popupOrder.subtotal || (popupOrder.items || []).reduce((acc: number, item: any) => acc + (item.subtotal || (item.unitPrice || item.price || 0) * (item.quantity || 1)), 0);
        const calculatedDiscount = popupOrder.discountAmount || 0;
        
        // If tax is missing on pending orders, compute using cash rate as default
        let calculatedTax = popupOrder.taxAmount || 0;
        if (!calculatedTax && session.cashTaxEnabled && session.cashTaxRate) {
           calculatedTax = (calculatedSubtotal - calculatedDiscount) * session.cashTaxRate;
        }
        
        // netAmount is the real post-tax grand total; totalAmount is only the
        // pre-tax subtotal (order.service.ts) — checking totalAmount first
        // meant this always printed the subtotal, since it's almost always truthy.
        const calculatedTotal = popupOrder.netAmount || popupOrder.totalAmount || popupOrder.total || (calculatedSubtotal - calculatedDiscount + calculatedTax);

        const printData = {
          orderNumber: popupOrder.orderNumber || popupOrder.id?.slice(-4) || 'N/A',
          tokenNumber: popupOrder.orderNumber || popupOrder.id?.slice(-4) || 'N/A',
          type: popupOrder.type || 'DINE_IN',
          cashierName: session.cashierName || undefined,
          tenantName: session.restaurantName || 'Dineiz',
          branchName: session.branchName || 'Main Branch',
          items: (popupOrder.items || []).map((item: any) => ({
            name: item.name || item.item?.name || item.menuItem?.name || 'Unknown Item',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
            subtotal: item.subtotal || ((item.unitPrice || item.price || 0) * (item.quantity || 1)),
            variationName: item.options?.variation?.name,
            addOnNames: item.options?.addOns?.map((a: any) => a.price ? `${a.name} (+${a.price})` : a.name)
          })),
          subtotal: calculatedSubtotal,
          discountAmount: calculatedDiscount,
          taxAmount: calculatedTax,
          total: calculatedTotal,
          paymentMethod: popupOrder.paymentMethod || 'PENDING',
          createdAt: popupOrder.createdAt ? new Date(popupOrder.createdAt) : undefined,
          dualTaxConfig: {
            cashTaxEnabled: session.cashTaxEnabled,
            cashTaxRate: session.cashTaxRate,
            cashTaxLabel: session.cashTaxLabel,
            cardTaxEnabled: session.cardTaxEnabled,
            cardTaxRate: session.cardTaxRate,
            cardTaxLabel: session.cardTaxLabel,
            showDualTaxOnReceipt: session.showDualTaxOnReceipt,
            taxRoundingMethod: session.taxRoundingMethod,
          }
        };
        try {
          const { printDocument } = await import('@/lib/print.service');
          await printDocument('CUSTOMER_BILL', printData as any);
        } catch (e: any) {
          console.warn('Failed to print bill', e);
          toast.error(e.message || 'Failed to print bill');
        }
      }

      await setTableStatus(selectedTable.id, 'BILL_REQUESTED');
      toast.success('Table updated to Bill Requested');
    } catch {
      toast.error('Failed to update table status');
    }
  };

  // ── Zoom controls ───────────────────────────────────────────────────────
  // Zooming keeps the CENTRE of the viewport fixed. Scaling around the origin
  // (what `setZoomLevel(z => z + 0.15)` alone did) slides the floor out from
  // under whatever the user was looking at, which reads as the map jumping.
  const zoomAround = useCallback((factor: number, anchor?: { x: number; y: number }) => {
    const el = canvasContainerRef.current;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      if (zoom === v.zoom) return v;
      const rect = el?.getBoundingClientRect();
      const ax = anchor?.x ?? (rect ? rect.width / 2 : 0);
      const ay = anchor?.y ?? (rect ? rect.height / 2 : 0);
      // Keep the floor-plan point currently under the anchor under it still.
      const ratio = zoom / v.zoom;
      return { zoom, x: ax - (ax - v.x) * ratio, y: ay - (ay - v.y) * ratio };
    });
  }, []);

  const handleZoomIn = () => zoomAround(1.2);
  const handleZoomOut = () => zoomAround(1 / 1.2);

  // ── Gestures ────────────────────────────────────────────────────────────
  //
  // One pointer-event path for mouse, pen and touch instead of a mouse set and
  // a touch set that drifted apart. The old mouse handler only started a pan
  // when `e.target === e.currentTarget`, but the 1200×700 transform wrapper
  // covers the whole container — so dragging anywhere over the floor did
  // nothing, and only the thin strip outside the wrapper panned. And there was
  // no `touch-action`, so on a phone the browser's own scroll/zoom fought every
  // gesture the handlers were trying to interpret.
  const handlePointerDown = (e: React.PointerEvent) => {
    // Let a tap on a table be a tap on a table.
    if ((e.target as HTMLElement).closest('[data-testid="table-node"]')) return;

    const g = gestureRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pointers.size === 1) {
      setIsPanning(true);
      g.start = { x: e.clientX, y: e.clientY, view, dist: 0 };
    } else if (g.pointers.size === 2) {
      const [a, b] = Array.from(g.pointers.values());
      g.start = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        view,
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g.pointers.has(e.pointerId) || !g.start) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pointers.size === 1) {
      scheduleView({
        zoom: g.start.view.zoom,
        x: g.start.view.x + (e.clientX - g.start.x),
        y: g.start.view.y + (e.clientY - g.start.y),
      });
      return;
    }

    // Two fingers: pinch to zoom about the midpoint, and pan with it.
    const [a, b] = Array.from(g.pointers.values());
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    const ax = mid.x - (rect?.left ?? 0);
    const ay = mid.y - (rect?.top ?? 0);
    const zoom = clamp(g.start.view.zoom * (dist / g.start.dist), MIN_ZOOM, MAX_ZOOM);
    const ratio = zoom / g.start.view.zoom;
    const startAx = g.start.x - (rect?.left ?? 0);
    const startAy = g.start.y - (rect?.top ?? 0);
    scheduleView({
      zoom,
      x: ax - (startAx - g.start.view.x) * ratio,
      y: ay - (startAy - g.start.view.y) * ratio,
    });
  };

  const endPointer = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 0) {
      g.start = null;
      setIsPanning(false);
      settleView();
    } else {
      // Lifting one of two fingers: re-anchor so the remaining one doesn't jump.
      const [a] = Array.from(g.pointers.values());
      g.start = { x: a.x, y: a.y, view, dist: 0 };
    }
  };

  // Trackpad / wheel zoom, anchored under the cursor.
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    zoomAround(e.deltaY > 0 ? 1 / 1.08 : 1.08, {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  };

  const floorTables = useMemo(
    () => tables.filter((t) => (t.floor || 1) === activeFloor),
    [tables, activeFloor],
  );

  // Live order total per table, for the phone list (the canvas shows this on
  // the table itself). Straight from the view store — no fetch.
  const viewOrders = useViews((s) => s.orders);
  const amountByTable = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of Object.values(viewOrders)) {
      if (!o.tableId) continue;
      if (!['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'].includes(o.status)) continue;
      m[o.tableId] = Number(o.netAmount ?? o.subtotal ?? 0);
    }
    return m;
  }, [viewOrders]);

  const listRows = useMemo(
    () => floorTables.map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      status: t.status,
      occupiedSince: t.occupiedSince,
      assignedWaiterName: t.assignedWaiterName,
      amount: amountByTable[t.id] ?? null,
    })),
    [floorTables, amountByTable],
  );

  /** Exact extent of a floor in floor-plan coordinates, chairs included. */
  const floorBounds = useMemo(() => {
    if (floorTables.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of floorTables) {
      const { width, height } = getTableDimensions(t.shape, t.capacity);
      minX = Math.min(minX, t.x - CHAIR_PAD);
      minY = Math.min(minY, t.y - CHAIR_PAD);
      maxX = Math.max(maxX, t.x + width + CHAIR_PAD);
      maxY = Math.max(maxY, t.y + height + CHAIR_PAD);
    }
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }, [floorTables]);

  /**
   * Keep at least a corner of the floor on screen.
   *
   * Without this a cashier can flick the plan into the void and be left staring
   * at an empty dot grid with no way back except the reset button — which they
   * have no reason to associate with "my tables vanished".
   */
  const settleView = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el || !floorBounds) return;
    const r = el.getBoundingClientRect();
    setView((v) => {
      const KEEP = 80; // px of content that must stay visible on each axis
      const left = floorBounds.minX * v.zoom + v.x;
      const top = floorBounds.minY * v.zoom + v.y;
      const w = floorBounds.width * v.zoom;
      const h = floorBounds.height * v.zoom;
      const x = v.x + clamp(0, KEEP - (left + w), r.width - KEEP - left);
      const y = v.y + clamp(0, KEEP - (top + h), r.height - KEEP - top);
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [floorBounds]);


  /**
   * Zoom/pan that centres the whole floor in the viewport with a comfortable
   * gutter.
   *
   * The old version derived bounds from the raw (x, y) points plus a flat
   * 110px margin — but (x, y) is a table's top-left, not its centre, and a
   * table is 88–180px wide — so the bounds were wrong in both directions, and
   * it then wrote the pan in screen pixels into a transform that consumed it in
   * scaled units. Combined, that put a phone's 54%-zoom floor half off the
   * right edge with dead space above and below.
   */
  const computeFit = useCallback((cw: number, ch: number) => {
    if (!floorBounds || cw === 0 || ch === 0) return null;
    const narrow = cw < 640;
    const gutter = narrow ? 16 : 40;

    // On a phone, legibility beats completeness.
    //
    // Fitting a typical 5×2 floor to 375px lands at ~57%: an 88px table renders
    // at 50px with a 9px label, which is neither readable nor a comfortable tap
    // target. Holding a floor at MIN_FIT_ZOOM_NARROW keeps tables at ~70px with
    // a ~13px label — you pan to reach whatever falls outside the viewport,
    // which is how any map on a phone works. On a tablet or a counter terminal
    // there's room to show the whole floor, so it fits properly there.
    const minFit = narrow ? MIN_FIT_ZOOM_NARROW : MIN_ZOOM;
    const zoom = clamp(
      Math.min((cw - gutter * 2) / floorBounds.width, (ch - gutter * 2) / floorBounds.height),
      minFit,
      1.4,
    );
    const scaledW = floorBounds.width * zoom;
    const scaledH = floorBounds.height * zoom;

    // An axis that still fits gets centred; one that overflows starts at the
    // gutter, so you open on the top-left of the room and pan from there rather
    // than in the middle of it with tables cut off on both sides.
    const x = scaledW <= cw - gutter * 2
      ? (cw - scaledW) / 2 - floorBounds.minX * zoom
      : gutter - floorBounds.minX * zoom;

    // Vertically, a floor that fits is centred on a tablet or desktop, where the
    // spare room reads as breathing space — but top-aligned on a phone, where a
    // wide layout on a tall portrait screen leaves so much slack that centring
    // strands the tables in the middle with dead space above AND below.
    const y = scaledH > ch - gutter * 2 || narrow
      ? gutter - floorBounds.minY * zoom
      : (ch - scaledH) / 2 - floorBounds.minY * zoom;

    return { zoom, x, y };
  }, [floorBounds]);

  const handleResetZoom = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = computeFit(r.width, r.height);
    if (next) setView(next);
  }, [computeFit]);

  // Fit on first paint of a floor, and on resize/rotation. Keyed on the table
  // COUNT, not the array: `status` changes the array's identity on every socket
  // push, and refitting then would yank the view out from under a cashier
  // mid-task. Table positions don't move during service.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || floorTables.length === 0) return;
    const fit = () => {
      const r = container.getBoundingClientRect();
      const next = computeFit(r.width, r.height);
      if (next) setView(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
    // `isNarrow` is a dependency because the canvas is not rendered at all in
    // the phone branch — `canvasContainerRef.current` is null there, so this
    // effect bails out early. Crossing the breakpoint the other way (a tablet
    // rotated to landscape) mounts a brand new container element, and without
    // this dep the effect wouldn't re-run: no fit, no ResizeObserver, and the
    // floor sat at its initial translate(0,0) scale(1) in the corner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor, floorTables.length, isNarrow, narrowView, wideView]);

  // The table detail sheets and modals, shared by both the canvas and the
  // phone list — they are driven by `selectedTable`, not by which layout is
  // on screen, so neither branch should own them.
  const tableDetailPanels = (
    <>
    {/* ── ASSIGN WAITER SHEET ────────────────────────────────────────────── */}
    {selectedTable && popupOrder && (
      <AssignWaiterSheet
        isOpen={isAssignWaiterOpen}
        onClose={() => setIsAssignWaiterOpen(false)}
        orderId={popupOrder.id}
        tableLabel={selectedTable.label}
        branchId={branchId}
        currentWaiterId={popupOrder.assignedWaiterId}
      />
    )}

    {/* TABLE DETAIL POPUP FOR OCCUPIED / BILL REQUESTED TABLES */}
    {selectedTable && (selectedTable.status === 'OCCUPIED' || selectedTable.status === 'BILL_REQUESTED' || selectedTable.status === 'READY') && (
      <Modal isOpen onClose={() => setSelectedTable(null)} label={`Table ${selectedTable.label}`} sheetOnMobile className="max-w-[420px]">
        <div className="p-5 space-y-4 overflow-y-auto">

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{selectedTable.label}</h3>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  selectedTable.status === 'BILL_REQUESTED'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {selectedTable.status === 'BILL_REQUESTED' ? 'Bill Requested' : 'Occupied'}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
              <Users className="w-3.5 h-3.5" /> {selectedTable.capacity} Seats
            </p>
          </div>
          <button
            onClick={() => setSelectedTable(null)}
            aria-label="Close table details" className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {popupLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              <span>Loading active order...</span>
            </div>
          ) : popupError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 text-center">
              <p className="text-xs text-rose-700 font-semibold">Couldn't load this table's order.</p>
              <button
                onClick={() => fetchActiveOrder(selectedTable.id)}
                className="text-xs font-bold text-rose-700 underline hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          ) : popupOrder ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 font-medium pb-1.5 border-b border-slate-200">
                <span>Order #{popupOrder.orderNumber || popupOrder.id?.slice(-4)}</span>
                <span className="text-amber-600 font-extrabold">
                  {formatPKR(popupOrder.total || popupOrder.totalAmount || 0)}
                </span>
              </div>
              <div className="max-h-[32dvh] overflow-y-auto space-y-1 pr-1">
                {popupOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>
                      {item.quantity}x {item.name || item.item?.name || item.menuItem?.name || 'Item'}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {formatPKR((item.subtotal || (item.unitPrice * item.quantity)) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-xs text-slate-500 font-medium">
              Tap Add Items to start adding
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          {/* Spec Part 11 — View Mode: no add-items, no payment. Print Bill
              and Assign Waiter stay; the rest becomes an "open a shift" prompt. */}
          {isViewMode() ? (
            <button
              onClick={() => router.push('/pos/shift/open')}
              className="w-full flex flex-col items-center justify-center gap-0.5 py-2 px-3 bg-sky-50 border border-sky-200 text-sky-700 font-bold text-xs rounded-xl transition-all leading-tight"
            >
              Open a shift to add items or take payment
              <span className="text-[9px] font-medium text-sky-500">You’re in view-only mode</span>
            </button>
          ) : (
            <button
              onClick={() => {
                router.push(
                  `/pos/order?type=dine-in&tableId=${selectedTable.id}&orderId=${popupOrder?.id || ''}&tableLabel=${encodeURIComponent(selectedTable.label)}`
                );
              }}
              className="w-full flex items-center justify-center gap-2 min-h-11 py-2.5 px-3 bg-brand hover:brightness-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Items</span>
            </button>
          )}

          <div className={`grid ${isViewMode() ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <button
              onClick={handlePrintBill}
              className="flex items-center justify-center gap-1.5 min-h-11 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all border border-slate-200"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Print Bill</span>
            </button>

            {!isViewMode() && (
            <button
              onClick={() => {
                if (!popupOrder) {
                  toast.error('No active order to collect payment for');
                  return;
                }
                if (popupLoading) {
                  toast.error('Still loading this order — try again in a moment');
                  return;
                }
                // PaymentModal computes the charge entirely from the
                // `items` it's given, falling back to the shared cart
                // store (empty, since this isn't the order-builder screen)
                // when it's handed none — opening it against a
                // stale/empty item list is how "Collect Payment" ends up
                // showing PKR 0 for a real order.
                if (!popupOrder.items || popupOrder.items.length === 0) {
                  toast.error("Couldn't load this order's items — close and reopen the table to retry");
                  return;
                }
                setIsPaymentOpen(true);
              }}
              disabled={popupLoading}
              className="flex items-center justify-center gap-1.5 min-h-11 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Collect Payment</span>
            </button>
            )}
          </div>

          {/* Assign Waiter Button */}
          <button
            onClick={() => setIsAssignWaiterOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 min-h-11 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl transition-all border border-slate-200"
          >
            {popupOrder?.assignedWaiterId ? (
              <>
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-1.5 text-blue-600"><User className="w-3.5 h-3.5" /> Assigned: {popupOrder.assignedWaiterName}</span>
                  <span className="text-[9px] text-slate-500 font-medium">Reassign Waiter</span>
                </div>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Assign to Waiter</span>
              </>
            )}
          </button>
        </div>
        </div>
      </Modal>
    )}

    {/* POPUP FOR RESERVED TABLES */}
    {selectedTable && selectedTable.status === 'RESERVED' && (
      <Modal isOpen onClose={() => setSelectedTable(null)} label={`Table ${selectedTable.label}`} sheetOnMobile className="max-w-[420px]">
        <div className="p-5 space-y-4 overflow-y-auto">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">{selectedTable.label}</h3>
          </div>
          <button
            onClick={() => setSelectedTable(null)}
            aria-label="Close table details" className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600">This table is reserved.</p>

        <button
          onClick={() => setShowOverrideModal(true)}
          className="w-full flex items-center justify-center gap-2 min-h-11 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Override (Manager PIN)</span>
        </button>
        </div>
      </Modal>
    )}

    {/* POPUP FOR DIRTY TABLES */}
    {selectedTable && selectedTable.status === 'DIRTY' && (
      <Modal isOpen onClose={() => setSelectedTable(null)} label={`Table ${selectedTable.label}`} sheetOnMobile className="max-w-[420px]">
        <div className="p-5 space-y-4 overflow-y-auto">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">{selectedTable.label}</h3>
          </div>
          <button
            onClick={() => setSelectedTable(null)}
            aria-label="Close table details" className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600">This table is marked as dirty.</p>

        <button
          onClick={() => handleMarkAsFree(selectedTable.id)}
          className="w-full flex items-center justify-center gap-2 min-h-11 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Mark as Free</span>
        </button>
        </div>
      </Modal>
    )}

    {/* Manager PIN Override Modal */}
    {showOverrideModal && selectedTable && (
      <AdminPinModal
        onClose={() => setShowOverrideModal(false)}
        onSuccess={async () => {
          setShowOverrideModal(false);
          // This clears the RESERVED override, not a cleaning timer —
          // handleMarkAsFree (markTableCleaned) only ever touches
          // lastCompletedAt, so it left the reservation itself in place
          // while toasting "Table marked as Free". setTableStatus with an
          // empty status clears statusOverride AND (per its own reducer)
          // the cleaning-timer anchor in one event, so the table actually
          // reaches FREE instead of re-deriving back to RESERVED/DIRTY.
          await setTableStatus(selectedTable.id, '');
          toast.success('Reservation cleared');
          setSelectedTable(null);
        }}
      />
    )}

    {/* Payment Modal */}
    {isPaymentOpen && popupOrder && selectedTable && (
      <PaymentModal
        isOpen={isPaymentOpen}
        orderId={popupOrder.id}
        orderNumber={popupOrder.orderNumber}
        orderTotal={popupOrder.total ?? popupOrder.totalAmount ?? 0}
        orderItems={popupOrder.items ? popupOrder.items.map((i: any) => `${i.quantity}x ${i.name || i.itemName || 'Item'}`).join(' · ') : 'Items'}
        items={popupOrder.items || []}
        tableLabel={selectedTable?.label}
        tableId={selectedTable.id}
        customerId={popupOrder.customerId || undefined}
        sentToKitchen={popupOrder.status !== 'PENDING'}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={async () => {
          setIsPaymentOpen(false);
          await handleMarkAsFree(selectedTable.id);
          toast.success('Payment collected & table freed');
        }}
      />
    )}
    </>
  );

  const matchesTable = (t: { label: string; status?: string }) =>
    (!tableSearch.trim() || t.label.toLowerCase().includes(tableSearch.trim().toLowerCase())) &&
    (statusFilter === 'ALL' || t.status?.toUpperCase() === statusFilter);
  const visibleTables = floorTables.filter(matchesTable);
  const tableToolbar = (
    <div className="shrink-0 bg-surface border-b border-line px-3 sm:px-6 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72 sm:shrink-0">
          <Search size={17} className="absolute left-3 top-3.5 text-ink-3" />
          <input aria-label="Find a table" placeholder="Find a table" value={tableSearch} onChange={e => setTableSearch(e.target.value)} className="w-full h-11 rounded-lg border border-line bg-canvas pl-10 pr-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </label>
        <select aria-label="Choose floor" value={activeFloor} onChange={e => setActiveFloor(Number(e.target.value))} className="h-11 min-w-0 rounded-lg border border-line bg-surface px-3 text-sm font-medium">
          {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>
        <div className="inline-flex ml-auto rounded-lg border border-line bg-canvas p-1">
          {(['list', 'plan'] as const).map(mode => <button key={mode} aria-pressed={showList === (mode === 'list')} aria-label={mode === 'list' ? 'Show table cards' : 'Show floor plan'} onClick={() => { if (isNarrow) { setNarrowView(mode); localStorage.setItem('pos_tables_view', mode); } else setWideView(mode); }} className={`h-11 px-2 sm:px-3 rounded-md inline-flex items-center gap-1 sm:gap-2 text-sm font-medium ${showList === (mode === 'list') ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'}`}>
            {mode === 'list' ? <Rows3 size={17} /> : <MapIcon size={17} />}<span className="inline">{mode === 'list' ? 'Cards' : 'Floor plan'}</span>
          </button>)}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter tables by status">
        {(['ALL', 'FREE', 'OCCUPIED', 'BILL_REQUESTED', 'RESERVED', 'DIRTY'] as const).map(status => {
          const count = status === 'ALL' ? floorTables.length : floorTables.filter(t => t.status?.toUpperCase() === status).length;
          const label = status === 'ALL' ? 'All tables' : status === 'FREE' ? 'Available' : status === 'BILL_REQUESTED' ? 'Bill requested' : status === 'DIRTY' ? 'To clean' : status === 'RESERVED' ? 'Reserved' : 'Occupied';
          return <button key={status} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`h-11 shrink-0 px-3 inline-flex items-center gap-2 rounded-lg text-[13px] font-medium border ${statusFilter === status ? 'bg-ink text-white border-ink' : 'border-transparent text-ink-3 hover:bg-canvas'}`}>
            {status !== 'ALL' && <span className={`w-1.5 h-1.5 rounded-full ${TABLE_TONE[status].dot}`} />}{label}<span className="opacity-70 tabular-nums">{count}</span>
          </button>;
        })}
      </div>
    </div>
  );

  if (showList) {
    return (
      <div className="w-full h-full flex flex-col bg-canvas text-ink select-none overflow-hidden">
        {tableToolbar}
        <TableListView tables={listRows.filter(matchesTable)} onTap={(row) => {
          const table = floorTables.find((t) => t.id === row.id);
          if (table) handleTableTap(table);
        }} />
        {tableDetailPanels}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-canvas text-ink select-none overflow-hidden relative">
      {tableToolbar}
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-2"><p className="text-sm font-semibold text-ink">Floor {activeFloor}</p><p className="mt-1 text-xs text-ink-3">{visibleTables.length} tables · Select a table to start or view an order</p></div>
      {/* Main Floor Canvas Container. height:100% (not the old hardcoded
          calc(100vh - 72px - 64px)) — this root now fills POSLayout's
          already-correctly-sized flex-1 content slot via h-full above, so
          this just needs to fill its parent rather than re-deriving the
          shell heights itself (see the same fix + reasoning in
          HomeDashboard.tsx). */}
      <div
        ref={canvasContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleWheel}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--pos-bg-base)',
          backgroundImage: 'none',
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          // Without this the browser's own pan/zoom fights every gesture the
          // handlers are trying to interpret — the single biggest reason the
          // floor plan felt broken on a phone.
          touchAction: 'none',
        }}
        className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
      >
        {visibleTables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <ServiceIllustration kind="floor" className="w-36 h-28 mb-2" />
            <p className="text-[14px] text-ink-3">No tables match. Try another filter.</p>
          </div>
        )}
        {/* Transform wrapper. `translate() scale()`, in that order — see the
            `view` comment at the top of this component for why the order is
            load-bearing. `inset: 0` rather than a hardcoded 1200×700 design
            surface: the surface only ever needed to be a positioning context
            for absolutely-placed tables, and a fixed size meant a floor plan
            laid out beyond it was simply unreachable. */}
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 120ms ease-out',
            position: 'absolute',
            inset: 0,
            willChange: 'transform',
          }}
        >
          {visibleTables.map((table) => (
            <div
              key={table.id}
              data-testid="table-node"
              data-table-status={(table.status || 'FREE').toLowerCase()}
              style={{
                position: 'absolute',
                left: `${table.x - CHAIR_PAD}px`,
                top: `${table.y - CHAIR_PAD}px`,
              }}
            >
              <PremiumTable
                label={table.label}
                capacity={table.capacity}
                shape={table.shape}
                status={table.status}
                occupiedSince={table.occupiedSince ?? undefined}
                isSelected={selectedTable?.id === table.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTableTap(table);
                }}
              />
              
              {/* Waiter Avatar Indicator directly on the floor map table */}
              {table.assignedWaiterName && table.status !== 'FREE' && table.status !== 'AVAILABLE' && (
                <div 
                  className="absolute bottom-3 left-3 w-6 h-6 rounded-full grid place-items-center text-white text-[10px] font-semibold border-2 border-surface z-20"
                  style={{ backgroundColor: table.assignedWaiterColor || '#3b82f6' }}
                  title={`Waiter: ${table.assignedWaiterName}`}
                >
                  {(() => {
                    const name = table.assignedWaiterName;
                    const parts = name.trim().split(' ');
                    return parts.length >= 2 
                      ? (parts[0][0] + parts[1][0]).toUpperCase() 
                      : name.substring(0, 2).toUpperCase();
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating Glassmorphism Zoom Controls */}
        <div className="absolute bottom-5 right-5 z-40 flex items-center gap-0.5 bg-surface border border-line p-1 rounded-xl shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-11 h-11 grid place-items-center rounded-lg text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[12.5px] font-semibold text-ink-2 w-12 text-center tabular-nums">
            {Math.round(view.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-11 h-11 grid place-items-center rounded-lg text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-line mx-0.5" />
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset View"
            className="w-11 h-11 grid place-items-center rounded-lg text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

      </div>

      {tableDetailPanels}
    </div>
  );
}
