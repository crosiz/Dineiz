'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AssignWaiterSheet } from './AssignWaiterSheet';
import { PremiumTable, getTableDimensions, CHAIR_PAD } from '@/components/PremiumTable';
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
  User,
  UserPlus,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useScreenSize } from '@/lib/use-screen-size';

const MIN_ZOOM = 0.3;
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


  // Status Legend Component for POSTopBar. hidden below sm: at phone width
  // POSTopBar's rightActions slot has only ~40-95px free once the always-
  // visible avatar/sync cluster takes its share, and this pill wants ~360px
  // unwrapped — rather than a barely-discoverable horizontal-scroll sliver,
  // it's dropped in favor of the table colors on the canvas itself (which
  // this legend is only a supplementary key for; tapping a table also shows
  // its status by name).
  const legendElement = useMemo(
    () => (
      <div className="hidden sm:flex items-center gap-3.5 text-xs font-semibold text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span>Free</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs animate-pulse" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
          <span>Billed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs" />
          <span>Reserved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
          <span>Dirty</span>
        </div>
      </div>
    ),
    []
  );

  // Configure TopBar explicitly without duplicate titles or clutter
  useTopBar({
    pageTitle: 'Floor Plan',
    rightActions: legendElement,
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
      const res = await fetch(`${API_URL}/api/orders?tableId=${tableId}&status=PENDING,IN_KITCHEN,READY,COMPLETED&limit=1`, {
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
    const gutter = cw < 640 ? 16 : 40;
    const zoom = clamp(
      Math.min((cw - gutter * 2) / floorBounds.width, (ch - gutter * 2) / floorBounds.height),
      MIN_ZOOM,
      1.4,
    );
    const scaledH = floorBounds.height * zoom;
    // Centre horizontally always. Vertically: centre on a tablet or desktop,
    // where the spare room reads as breathing space around the plan — but
    // top-align on a phone, where a wide layout fitted to a tall portrait
    // screen leaves so much slack that centring strands the tables in the
    // middle with dead space above AND below. Collecting it all at the bottom
    // (where the zoom controls live) reads as a floor plan instead of a
    // mistake.
    const y = cw < 640
      ? gutter - floorBounds.minY * zoom
      : (ch - scaledH) / 2 - floorBounds.minY * zoom;

    return {
      zoom,
      x: (cw - floorBounds.width * zoom) / 2 - floorBounds.minX * zoom,
      y,
    };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor, floorTables.length]);

  /**
   * Where a table's detail card goes.
   *
   * On a phone it's a bottom sheet — anchoring a 320px card to a table on a
   * 375px screen leaves it covering the table it describes and half the floor,
   * and the old version clamped against `window.innerWidth/innerHeight` with
   * hardcoded 340/380px card sizes, which is neither this container's size nor
   * the card's. On a larger screen it sits beside the table, clamped to the
   * canvas's own rect.
   */
  const getPopupPosition = (table: TableData): React.CSSProperties => {
    if (isNarrow) return {};
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const { width } = getTableDimensions(table.shape, table.capacity);
    const screenX = rect.left + table.x * view.zoom + view.x;
    const screenY = rect.top + table.y * view.zoom + view.y;

    const CARD_W = 320;
    const CARD_H = 380;
    // Prefer the right of the table; flip to the left when that would overflow.
    const wantLeft = screenX + (width + CHAIR_PAD) * view.zoom + 12;
    const left = wantLeft + CARD_W > rect.right - 16
      ? Math.max(rect.left + 16, screenX - CARD_W - 12)
      : wantLeft;
    const top = clamp(screenY - 24, rect.top + 16, Math.max(rect.top + 16, rect.bottom - CARD_H - 16));
    return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
  };

  /** Shared shell for the three table-detail cards (occupied / reserved / dirty). */
  const popupShellCls = isNarrow
    ? 'fixed inset-x-0 bottom-0 z-[var(--z-modal)] w-full max-h-[80dvh] overflow-y-auto bg-surface border-t border-line rounded-t-2xl shadow-2xl p-5 pb-safe space-y-4 text-ink animate-in slide-in-from-bottom duration-200'
    : 'fixed z-[var(--z-modal)] w-80 max-h-[calc(100dvh-32px)] overflow-y-auto bg-surface border border-line rounded-2xl shadow-2xl p-5 space-y-4 text-ink animate-in fade-in zoom-in-95 duration-150';

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 text-slate-900 select-none overflow-hidden relative">
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
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--pos-bg-base)',
          backgroundImage: 'radial-gradient(var(--pos-border-strong) 1.2px, transparent 1.2px)',
          backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          // Without this the browser's own pan/zoom fights every gesture the
          // handlers are trying to interpret — the single biggest reason the
          // floor plan felt broken on a phone.
          touchAction: 'none',
        }}
        className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
      >
        {/* Floating Glassmorphism Floor Switcher — scrolls horizontally past
            3-4 floors instead of running off the edge of a narrow screen. */}
        {floors.length > 1 && (
          <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-auto z-40 flex items-center gap-1.5 bg-white/90 border border-slate-200 p-1.5 rounded-2xl shadow-xl backdrop-blur-md max-w-[calc(100%-2rem)] overflow-x-auto no-scrollbar">
            <Layers className="w-4 h-4 text-amber-600 ml-1 mr-0.5 shrink-0" />
            {floors.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 ${
                  activeFloor === f
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Floor {f}
              </button>
            ))}
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
          {floorTables.map((table) => (
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
                  className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-md border-[1.5px] border-white z-10"
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
        <div className="absolute bottom-6 right-6 z-40 flex items-center gap-1.5 bg-white/90 border border-slate-200 p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 w-12 text-center">
            {Math.round(view.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 my-auto" />
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset View"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

      </div>

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
        <div
          style={getPopupPosition(selectedTable)}
          className={popupShellCls}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">{selectedTable.label}</h3>
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
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
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
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Items</span>
              </button>
            )}

            <div className={`grid ${isViewMode() ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
              <button
                onClick={handlePrintBill}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all border border-slate-200"
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
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Collect Payment</span>
              </button>
              )}
            </div>

            {/* Assign Waiter Button */}
            <button
              onClick={() => setIsAssignWaiterOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl transition-all border border-slate-200"
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
      )}

      {/* POPUP FOR RESERVED TABLES */}
      {selectedTable && selectedTable.status === 'RESERVED' && (
        <div
          style={getPopupPosition(selectedTable)}
          className={popupShellCls}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">{selectedTable.label}</h3>
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600">This table is reserved.</p>

          <button
            onClick={() => setShowOverrideModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Override (Manager PIN)</span>
          </button>
        </div>
      )}

      {/* POPUP FOR DIRTY TABLES */}
      {selectedTable && selectedTable.status === 'DIRTY' && (
        <div
          style={getPopupPosition(selectedTable)}
          className={popupShellCls}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">{selectedTable.label}</h3>
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600">This table is marked as dirty.</p>

          <button
            onClick={() => handleMarkAsFree(selectedTable.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark as Free</span>
          </button>
        </div>
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
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={async () => {
            setIsPaymentOpen(false);
            await handleMarkAsFree(selectedTable.id);
            toast.success('Payment collected & table freed');
          }}
        />
      )}
    </div>
  );
}
