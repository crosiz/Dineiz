'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AssignWaiterSheet } from './AssignWaiterSheet';
import { PremiumTable } from '@/components/PremiumTable';
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  const [activeFloor, setActiveFloor] = useState<number>(1);

  // Canvas Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected Table & Popups
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [popupOrder, setPopupOrder] = useState<any>(null);
  const [popupLoading, setPopupLoading] = useState<boolean>(false);
  const [popupError, setPopupError] = useState<boolean>(false);
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isAssignWaiterOpen, setIsAssignWaiterOpen] = useState<boolean>(false);

  // Touch gesture tracking
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1.0);

  // Status Legend Component for POSTopBar
  const legendElement = useMemo(
    () => (
      <div className="flex items-center gap-3.5 text-xs font-semibold text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200">
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

  // Fetch active order for occupied tables — paints instantly from cache
  // (if this table's order was already viewed this session) while the
  // network request below refreshes it silently in the background.
  const fetchActiveOrder = useCallback(async (tableId: string) => {
    setPopupError(false);

    const cacheKey = `table-order-${tableId}`;
    const cached = await getDB().ordersCache.get(cacheKey).catch(() => null);
    if (cached?.data?.[0]) {
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

  // Canvas Pan & Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.0, z + 0.15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, z - 0.15));
  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanX(0);
    setPanY(0);
  };

  // Mouse pan event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - panX, y: e.clientY - panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanX(e.clientX - startPanRef.current.x);
    setPanY(e.clientY - startPanRef.current.y);
  };

  const handleMouseUp = () => setIsPanning(false);

  // Touch gesture handlers for mobile / tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      startPanRef.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistanceRef.current = dist;
      initialZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      setPanX(e.touches[0].clientX - startPanRef.current.x);
      setPanY(e.touches[0].clientY - startPanRef.current.y);
    } else if (e.touches.length === 2 && initialTouchDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / initialTouchDistanceRef.current;
      setZoomLevel(Math.min(2.0, Math.max(0.5, initialZoomRef.current * scale)));
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    initialTouchDistanceRef.current = null;
  };

  const floorTables = tables.filter((t) => (t.floor || 1) === activeFloor);

  // Position popup card relative to table center
  const getPopupPosition = (table: TableData) => {
    const posX = table.x * zoomLevel + panX;
    const posY = table.y * zoomLevel + panY;

    const popupLeft = Math.min(Math.max(16, posX + 110), window.innerWidth - 340);
    const popupTop = Math.min(Math.max(16, posY - 20), window.innerHeight - 380);

    return { left: `${popupLeft}px`, top: `${popupTop}px` };
  };

  return (
    <div className="w-full flex flex-col bg-slate-100 text-slate-900 select-none overflow-hidden relative">
      {/* Main Floor Canvas Container */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          height: 'calc(100vh - 72px - 64px)',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#F8FAFC',
          backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        {/* Floating Glassmorphism Floor Switcher */}
        {floors.length > 1 && (
          <div className="absolute top-6 left-6 z-40 flex items-center gap-1.5 bg-white/90 border border-slate-200 p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
            <Layers className="w-4 h-4 text-amber-600 ml-1 mr-0.5" />
            {floors.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
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

        {/* Transform Scale & Pan Wrapper */}
        <div
          style={{
            transform: `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            width: '1200px',
            height: '700px',
            position: 'absolute',
          }}
        >
          {floorTables.map((table) => (
            <div
              key={table.id}
              data-testid="table-node"
              data-table-status={(table.status || 'FREE').toLowerCase()}
              style={{
                position: 'absolute',
                left: `${table.x - 20}px`,
                top: `${table.y - 20}px`,
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
            {Math.round(zoomLevel * 100)}%
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
          className="fixed z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
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
                    Rs. {(popupOrder.total || popupOrder.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {popupOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>
                        {item.quantity}x {item.name || item.item?.name || item.menuItem?.name || 'Item'}
                      </span>
                      <span className="text-slate-500 font-medium">
                        Rs. {((item.subtotal || (item.unitPrice * item.quantity)) || 0).toLocaleString()}
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
          className="fixed z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
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
          className="fixed z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
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
          onSuccess={() => {
            setShowOverrideModal(false);
            handleMarkAsFree(selectedTable.id);
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
