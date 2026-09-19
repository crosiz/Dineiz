'use client';

import { ServiceIllustration } from '@/components/ServiceIllustration';
import { Modal } from '@/components/ui/Modal';
import { useBrandingStore } from '@/lib/branding-store';
import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTopBar } from '@/hooks/useTopBar';
import { useSocket } from '@/contexts/SocketContext';
import { getToken, getPosSession } from '@/lib/pos-session';
import { formatPKR } from '@/lib/utils';
import { useSWROrders } from '@/hooks/useSWROrders';
import { useViews, type OrderView } from '@/lib/core/views';
import { markReady, sendToKitchen } from '@/lib/core/commands';
import { toast } from 'sonner';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { TicketCard, TicketIconButton, type TicketAction, type TicketLine } from '@/components/orders/TicketCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { API_URL } from '@/lib/api';
import { Armchair, ChevronDown, CircleUser, Clock, Columns3, LayoutGrid, ListFilter, Loader2, MessageSquare, Plus, Printer, QrCode, Rows3, Search, Trash2, User, X, Zap } from 'lucide-react';

/**
 * Collapse identical lines for display: "1x Seekh Kabab" × 4 → "4x Seekh Kabab".
 *
 * An order gains a separate line for every add — the first punch, then each
 * add-to-table round — which is correct for the KOT and the bill (the kitchen
 * needs to know what was ordered when, and a void applies to one line). It is
 * not what you want on a summary card: four identical rows ate the four visible
 * slots and pushed everything else behind "+ N MORE ITEMS".
 *
 * Lines are only merged when the name AND unit price AND options AND note all
 * match — a half-price line, or one with "no chilli", stays separate because it
 * is genuinely a different thing.
 */
function mergeDisplayLines(items: any[]): any[] {
  if (!Array.isArray(items) || items.length < 2) return items ?? [];
  const out: any[] = [];
  const byKey = new Map<string, any>();

  for (const item of items) {
    const name = item?.name ?? item?.itemName ?? item?.item?.name ?? '';
    const unit = item?.unitPrice ?? item?.price ?? 0;
    const qty = item?.quantity ?? item?.qty ?? 1;
    const key = JSON.stringify([name, unit, item?.options ?? null, item?.notes ?? item?.note ?? null]);

    const existing = byKey.get(key);
    if (!existing) {
      const copy = { ...item, quantity: qty, qty };
      byKey.set(key, copy);
      out.push(copy);
      continue;
    }
    existing.quantity += qty;
    existing.qty = existing.quantity;
    // Keep subtotal consistent so anything summing these still adds up.
    if (typeof existing.subtotal === 'number') existing.subtotal = existing.quantity * unit;
  }
  return out;
}

interface Props {
  onViewChange?: (view: 'home' | 'menu' | 'tickets') => void;
}

export default function TicketsDashboard({ onViewChange }: Props) {
  const router = useRouter();
  const session = useCartStore(s => s.session);
  const [isMounted, setIsMounted] = useState(false);

  // KDS setting — the tenant-wide "Use KDS" toggle (Settings → Kitchen) is the
  // master switch: turning it off disables KDS everywhere immediately. The
  // branch-level flag (set in Add/Edit Branch) only matters as a per-branch
  // opt-out while the tenant-wide toggle is on — it can never turn KDS ON by
  // itself. Previously this was OR'd, so a branch defaulting to
  // kdsEnabled=true meant the tenant-wide toggle could never actually turn
  // KDS off.
  // When useKDS is false: PENDING orders get 'Mark Ready' button, not 'Send to Kitchen'
  const useKDS = useBrandingStore(s => !!s.branding.kitchen?.useKDS && s.branding.branchKdsEnabled !== false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { socket } = useSocket();
  const [myOrdersOnly, setMyOrdersOnly] = useState(false);
  
  const [waiters, setWaiters] = useState<any[]>([]);
  useEffect(() => {
    if (!session?.branchId) return;
    fetch(`${API_URL}/api/pos/waiters?branchId=${session.branchId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    .then(r => r.json())
    .then(data => setWaiters(data.waiters || data))
    .catch(() => {});
  }, [session?.branchId]);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('pos_viewMode');
    if (saved === 'grid' || saved === 'list' || saved === 'kanban') {
      setViewMode(saved);
    }
  }, []);

  // The view-mode switcher below is `hidden sm:flex` — Kanban's fixed-width
  // horizontal-scroll columns aren't a workable layout on a phone, so the
  // switcher simply doesn't offer it there. Without this guard, a terminal
  // that had Kanban selected on a tablet (view mode persists via
  // localStorage) would open straight into it on a phone with no visible way
  // back to Grid/List, since the only control that could change it is the
  // one that's hidden. Forces back to Grid whenever the viewport narrows
  // past sm, whatever's saved.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const enforce = () => {
      if (mq.matches) setViewMode((m) => (m === 'kanban' ? 'grid' : m));
    };
    enforce();
    mq.addEventListener('change', enforce);
    return () => mq.removeEventListener('change', enforce);
  }, []);

  const handleSetViewMode = (mode: 'grid' | 'list' | 'kanban') => {
    setViewMode(mode);
    localStorage.setItem('pos_viewMode', mode);
  };

  const [dataMode, setDataMode] = useState<'live' | 'history'>('live');

  // One-shot cross-page signal — lets another screen (e.g. Manager Panel's
  // "Reprint Last Receipt") land here already in History mode without
  // needing URL query params (which would require a Suspense boundary here).
  useEffect(() => {
    if (sessionStorage.getItem('pos_tickets_initial_mode') === 'history') {
      sessionStorage.removeItem('pos_tickets_initial_mode');
      setDataMode('history');
    }
  }, []);
  const [filter, setFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'WHATSAPP'>('ALL');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest' | 'table'>('oldest');
  const [historySearch, setHistorySearch] = useState('');
  const [waiterFilter, setWaiterFilter] = useState<string>('ALL');

  // MODAL TEMP STATE
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempDataMode, setTempDataMode] = useState<'live' | 'history'>('live');
  const [tempFilter, setTempFilter] = useState<string>('ALL');
  const [tempSortOrder, setTempSortOrder] = useState<'oldest' | 'newest' | 'table'>('oldest');
  const [tempSearch, setTempSearch] = useState('');
  const [tempWaiterFilter, setTempWaiterFilter] = useState<string>('ALL');

  const openFilterModal = () => {
    setTempDataMode(dataMode);
    setTempFilter(filter);
    setTempSortOrder(sortOrder);
    setTempSearch(historySearch);
    setTempWaiterFilter(waiterFilter);
    setFilterModalOpen(true);
  };

  const applyFilters = () => {
    setDataMode(tempDataMode);
    setFilter(tempFilter);
    setSortOrder(tempSortOrder);
    setHistorySearch(tempSearch);
    setWaiterFilter(tempWaiterFilter);
    setFilterModalOpen(false);
  };

  const resetFilters = () => {
    setTempDataMode('live');
    setTempFilter('ALL');
    setTempSortOrder('oldest');
    setTempSearch('');
    setTempWaiterFilter('ALL');
  };

  const [shiftSummaryOpen, setShiftSummaryOpen] = useState(false);
  const [shiftElapsed, setShiftElapsed] = useState('Active');
  
  const queryClient = useQueryClient();

  useTopBar({
    pageTitle: dataMode === 'live' ? 'Active Orders' : 'Order History',
    breadcrumb: session?.branchName || getPosSession()?.branchName || 'Branch',
    showBackButton: true,
    backPath: '/pos/home',
    rightActions: (
      <div className="flex items-center gap-3">
        <button onClick={openFilterModal} className={`flex items-center justify-center rounded-xl h-[42px] w-[42px] transition-all border shadow-sm ${dataMode === 'history' ? 'bg-brand border-brand text-white' : 'bg-white border-line-strong text-ink-2 hover:bg-canvas hover:text-ink'}`} title="Advanced Filter & History">
          <ListFilter className="w-[22px] h-[22px] transition-colors" />
        </button>
        <button onClick={() => setShiftSummaryOpen(true)} className="flex items-center justify-center rounded-xl h-[42px] w-[42px] bg-white hover:bg-canvas transition-all border border-line-strong text-ink-2 hover:text-ink shadow-sm" title="Shift Summary">
          <Clock className="w-[22px] h-[22px] transition-colors" />
        </button>
        <button onClick={() => setMyOrdersOnly(!myOrdersOnly)} className={`flex items-center justify-center rounded-xl h-[42px] w-[42px] transition-all border shadow-sm ${myOrdersOnly ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink-2 hover:bg-canvas hover:text-ink'}`} title="My Orders">
          <CircleUser className="w-[22px] h-[22px] transition-colors" />
        </button>
      </div>
    )
  });

  useEffect(() => {
    let openedAtStr: string | null = null;
    try {
      const shiftData = JSON.parse(localStorage.getItem('pos_shift') || '{}');
      openedAtStr = shiftData.openedAt;
    } catch {}

    if (!openedAtStr) return;
    
    const openedAt = new Date(openedAtStr).getTime();
    const tick = () => {
      const ms = Date.now() - openedAt;
      if (ms < 0) return;
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setShiftElapsed(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);


  // History is a genuinely different concern from live operational state —
  // paginated search over orders that are, by definition, no longer live —
  // and stays on the existing fetch-based hook. `enabled: false` in live
  // mode means it doesn't poll '/api/orders/live' in the background for
  // data this screen no longer renders from it.
  const { orders: historyOrders, isFetching, isStale } = useSWROrders({
    branchId: session.branchId,
    dataMode,
    myOrdersOnly,
    cashierId: session.cashierId,
    waiterId: waiterFilter,
    sortOrder,
    historySearch,
    refetchIntervalMs: 15_000,
    enabled: dataMode === 'history',
  });

  // Phase 2: live orders read directly from the shared event-derived store
  // — populated by lib/core/views.ts's refreshOrders (bootstrap + socket-
  // driven, see POSLayout.tsx) merged with anything this terminal created
  // locally. No fetch, no loading state, no per-screen polling.
  const LIVE_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
  // Select the raw map, derive with useMemo — building the array inside the
  // selector made this re-render on every store notification (see the same note
  // in HomeDashboard).
  const ordersMap = useViews((s) => s.orders);
  const liveOrdersRaw = useMemo(
    () => Object.values(ordersMap).filter((o) => LIVE_STATUSES.includes(o.status)),
    [ordersMap],
  );
  const liveOrders = useMemo(() => {
    const sorted = [...liveOrdersRaw];
    if (sortOrder === 'oldest') sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortOrder === 'newest') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortOrder === 'table') sorted.sort((a, b) => (a.tableLabel || '').localeCompare(b.tableLabel || ''));
    if (myOrdersOnly && session.cashierId) {
      return sorted.filter((o) => o.cashierId === session.cashierId || o.assignedWaiterId === session.cashierId);
    }
    if (waiterFilter && waiterFilter !== 'ALL') {
      return sorted.filter((o) => o.assignedWaiterId === waiterFilter);
    }
    return sorted;
  }, [liveOrdersRaw, sortOrder, myOrdersOnly, waiterFilter, session.cashierId]);

  const orders: any[] = dataMode === 'history' ? historyOrders : liveOrders;

  // For history mode: show a spinner only on the very first load (no IDB data yet)
  // Live mode never blocks — the view store is always already populated.
  // Live orders come from the view store, which replays the local event log on
  // start; until it has, "no orders" would be a lie.
  const viewsReady = useViews((st) => st.isReady);
  const isLoading = dataMode === 'history' ? (isFetching && orders.length === 0) : !viewsReady;

  const heldOrders = useLiveQuery(() => {
    const db = getDB();
    return db.heldOrders ? db.heldOrders.toArray() : [];
  }) || [];

  const counts = useMemo(() => {
    if (!orders || dataMode === 'history') return { ALL: 0, DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0, ON_HOLD: 0, WHATSAPP: 0 };
    const nonCompleted = orders.filter((o: any) => o.status !== 'COMPLETED');
    return {
      ALL: nonCompleted.length,
      DINE_IN: nonCompleted.filter((o: any) => o.type === 'DINE_IN').length,
      TAKEAWAY: nonCompleted.filter((o: any) => o.type === 'TAKEAWAY').length,
      DELIVERY: nonCompleted.filter((o: any) => o.type === 'DELIVERY').length,
      ON_HOLD: heldOrders.length,
      WHATSAPP: nonCompleted.filter((o: any) => o.source === 'WHATSAPP').length,
    };
  }, [orders, heldOrders, dataMode]);

  const statusCounts = useMemo(() => {
    const live = (orders ?? []).filter((o: any) => o.status !== 'COMPLETED');
    return {
      ALL: live.length + heldOrders.length,
      PENDING: live.filter((o: any) => o.status === 'PENDING').length,
      IN_KITCHEN: live.filter((o: any) => o.status === 'IN_KITCHEN').length,
      READY: live.filter((o: any) => o.status === 'READY').length,
      HELD: heldOrders.length,
    };
  }, [orders, heldOrders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (dataMode === 'history') return filter === 'ALL' ? orders : orders.filter((o: any) => o.status === filter);

    const bySource = (list: any[]) => list.filter((o: any) => {
      const q = historySearch.trim().toLowerCase();
      return (sourceFilter === 'ALL' || o.source === sourceFilter) &&
        (!q || [o.orderNumber, o.tokenNumber, o.tableLabel, o.customerName, o.customerPhone].some(v => String(v ?? '').toLowerCase().includes(q)));
    });

    const nonCompleted = orders.filter((o: any) => o.status !== 'COMPLETED');
    if (filter === 'ALL') return bySource(nonCompleted);
    if (filter === 'ON_HOLD' || filter === 'HELD') return bySource(heldOrders);

    // Check if filter is an order status
    if (['PENDING', 'IN_KITCHEN', 'READY'].includes(filter)) {
      return bySource(nonCompleted.filter((o: any) => o.status === filter));
    }

    // Otherwise it's an order type (DINE_IN, TAKEAWAY, DELIVERY)
    return bySource(nonCompleted.filter((o: any) => o.type === filter));
  }, [orders, filter, heldOrders, dataMode, sourceFilter, historySearch]);

  // Live tickets read fastest grouped by service type first — dine-in tables
  // in one lane, takeaway/delivery in another — status is a secondary filter
  // within each lane, not the top-level axis.
  const dineInOrders = useMemo(
    () => filteredOrders.filter((o: any) => o.type === 'DINE_IN'),
    [filteredOrders]
  );
  const otherOrders = useMemo(
    () => filteredOrders.filter((o: any) => o.type !== 'DINE_IN'),
    [filteredOrders]
  );
  const groupByType = dataMode === 'live' && filter !== 'HELD' && filter !== 'ON_HOLD';



  const updateOrderStatus = async (orderId: string, newStatus: 'IN_KITCHEN' | 'READY') => {
    setIsUpdating(orderId);

    // Local-first: the command appends an event and updates useViews
    // synchronously — every screen reading that store (Home, Tickets, and
    // eventually KDS) sees the new status instantly, permanently. This does
    // NOT roll back on a sync failure — the physical action (food sent to
    // the kitchen / marked ready) already happened; reverting the screen
    // would just reintroduce the "shows updated then flips back" bug.
    // Shipping the change to the server, with retry/backoff, is the
    // outbox's job now (lib/core/outbox.ts's UPDATE_STATUS task) — it runs
    // independently of this screen and doesn't need a try/catch here.
    if (newStatus === 'READY') await markReady(orderId);
    else await sendToKitchen(orderId);
    setIsUpdating(null);
  };

  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  // Full order object already in `orders` (from useSWROrders) — passed as
  // initialOrder so OrderDetailsModal paints instantly instead of blocking
  // on a fresh GET /api/orders/:id every time a card is tapped.
  const [detailsOrder, setDetailsOrder] = useState<any>(null);
  const [deleteHeldTarget, setDeleteHeldTarget] = useState<string | null>(null);
  const deleteHeldOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteHeldTarget(orderId);
  };
  const confirmDeleteHeldOrder = async () => {
    if (!deleteHeldTarget) return;
    const db = getDB();
    await db.heldOrders.delete(deleteHeldTarget);
    setDeleteHeldTarget(null);
  };

  // Prints the same customer bill produced by the "Print Bill" action on the
  // Tables screen (ClientTableMap.tsx) — same payload shape, same template,
  // so a ticket printed here and a bill printed from the floor plan match.
  const [printingId, setPrintingId] = useState<string | null>(null);
  const handlePrintBill = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrintingId(order.id);
    try {
      let parsedItems: any[] = [];
      if (order.cart) {
        parsedItems = typeof order.cart === 'string' ? JSON.parse(order.cart) : (order.cart || []);
      } else if (typeof order.items === 'string') {
        try { parsedItems = JSON.parse(order.items); } catch { parsedItems = []; }
      } else {
        parsedItems = order.items || [];
      }

      const calculatedSubtotal = order.subtotalAmount || order.subtotal
        || parsedItems.reduce((acc: number, item: any) => acc + (item.subtotal || (item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1)), 0);
      const calculatedDiscount = order.discountAmount || 0;
      let calculatedTax = order.taxAmount || 0;
      if (!calculatedTax && session.cashTaxEnabled && session.cashTaxRate) {
        calculatedTax = (calculatedSubtotal - calculatedDiscount) * session.cashTaxRate;
      }
      const calculatedTotal = order.netAmount || order.totalAmount || order.total || (calculatedSubtotal - calculatedDiscount + calculatedTax);

      const printData = {
        orderNumber: order.orderNumber || order.id?.slice(-4) || 'N/A',
        tokenNumber: order.tokenNumber || order.orderNumber || order.id?.slice(-4) || 'N/A',
        type: order.type || 'DINE_IN',
        cashierName: session.cashierName || undefined,
        tenantName: session.restaurantName || 'Dineiz',
        branchName: session.branchName || 'Main Branch',
        items: parsedItems.map((item: any) => ({
          name: item.name || item.itemName || item.item?.name || 'Unknown Item',
          quantity: item.quantity || item.qty || 1,
          unitPrice: item.unitPrice || item.price || 0,
          subtotal: item.subtotal || ((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1)),
          variationName: item.options?.variation?.name || item.selectedVariation?.name,
          addOnNames: (item.options?.addOns || item.selectedAddOns)?.map((a: any) => a.price ? `${a.name} (+${a.price})` : a.name),
        })),
        subtotal: calculatedSubtotal,
        discountAmount: calculatedDiscount,
        taxAmount: calculatedTax,
        total: calculatedTotal,
        paymentMethod: order.paymentMethod || 'PENDING',
        createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        tableLabel: order.tableLabel || undefined,
        dualTaxConfig: {
          cashTaxEnabled: session.cashTaxEnabled,
          cashTaxRate: session.cashTaxRate,
          cashTaxLabel: session.cashTaxLabel,
          cardTaxEnabled: session.cardTaxEnabled,
          cardTaxRate: session.cardTaxRate,
          cardTaxLabel: session.cardTaxLabel,
          showDualTaxOnReceipt: session.showDualTaxOnReceipt,
          taxRoundingMethod: session.taxRoundingMethod,
        },
      };

      const { printDocument } = await import('@/lib/print.service');
      await printDocument('CUSTOMER_BILL', printData as any);
      toast.success('Bill sent to printer');

      // Same "table turns blue" signal the floor plan's own Print Bill
      // action already sets (ClientTableMap.tsx) — this was the one other
      // place a dine-in bill gets printed from, and it never touched table
      // status, so a bill printed from here left the table looking untouched
      // on the floor plan even though the bill had gone out.
      if (order.type === 'DINE_IN' && order.tableId) {
        fetch(`${API_URL}/api/tables/${order.tableId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ status: 'BILL_REQUESTED' }),
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Failed to print bill', err);
      toast.error(err?.message || 'Failed to print bill');
    } finally {
      setPrintingId(null);
    }
  };

  const renderCard = (order: any, layout: 'grid' | 'list' | 'kanban') => {
    const isReady = order.status === 'READY';
    const isPending = order.status === 'PENDING';
    const isInKitchen = order.status === 'IN_KITCHEN';
    const isUpdatingThis = isUpdating === order.id;
    const isQR = order.source === 'QR_CODE';
    const isWhatsApp = order.source === 'WHATSAPP';
    
    // Check if paid online
    const hasPaidOnline = order.payments?.some((p: any) => p.method === 'ONLINE' && p.status === 'COMPLETED') 
      || (order.source === 'QR_CODE' && order.paymentStatus === 'PAID');

    const typeLabel = order.type === 'DINE_IN' ? 'DINE-IN' : order.type === 'TAKEAWAY' ? 'TAKEAWAY' : 'DELIVERY';
    
    let rawItems: any[] = [];
    if (order.cart) {
      rawItems = typeof order.cart === 'string' ? JSON.parse(order.cart) : (order.cart || []);
    } else if (typeof order.items === 'string') {
      try { rawItems = JSON.parse(order.items); } catch(e) {}
    } else {
      rawItems = order.items || [];
    }

    // Identical lines are merged for DISPLAY.
    //
    // An order picks up a separate line every time something is added — a first
    // punch, then an add-to-table round, then another — so four Seekh Kababs
    // arrive as four ITEM_ADDED events and rendered as "1x Seekh Kabab" four
    // times over. On a card that shows four lines before "+ 10 MORE ITEMS",
    // that filled the whole card with one dish and hid everything else. The
    // underlying lines are untouched (the KOT and the bill still need them
    // separately); this is only what the card shows.
    const parsedItems = mergeDisplayLines(rawItems);

    let calculatedTotal = 0;
    if (order.heldAt && parsedItems.length > 0) {
      calculatedTotal = parsedItems.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || item.qty || 1)), 0);
    }

    const totalAmount = order.heldAt ? calculatedTotal.toFixed(0) : Number(order.netAmount || order.totalAmount || order.total || order.subtotal || 0).toFixed(0);
    const timeRef = order.createdAt || order.dateTime || order.heldAt;

    const onActionClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (dataMode === 'history') return;
      if (isPending) {
        // If no KDS: go directly to READY (cashier manually marks food ready)
        // If KDS active: go to IN_KITCHEN so KDS screen picks it up
        const nextStatus = 'IN_KITCHEN';
        updateOrderStatus(order.id, nextStatus);
      } else if (isReady) {
        const typeStr = order.type ? order.type.toLowerCase().replace('_', '-') : 'dine-in';
        router.push(`/pos/order?orderId=${order.id}&tableId=${order.tableId ?? ''}&tableLabel=${order.tableLabel ?? ''}&type=${typeStr}&checkout=true&totalAmount=${totalAmount}`);
      } else if (isInKitchen) {
        // When useKDS is false but order is somehow in IN_KITCHEN (legacy), allow marking ready
        if (!useKDS) {
          updateOrderStatus(order.id, 'READY');
        }
        // When useKDS is true, KDS screen handles this — don't allow from POS
      } else if (!isInKitchen) {
        const typeStr = order.type ? order.type.toLowerCase().replace('_', '-') : 'dine-in';
        router.push(`/pos/order?orderId=${order.id}&edit=true&isHeld=${!!order.heldAt}&tableId=${order.tableId ?? ''}&tableLabel=${order.tableLabel ?? ''}&type=${typeStr}`);
      }
    };

    const openOrder = () => {
      if (order.heldAt) {
        // Held orders are local drafts (IndexedDB only) — resuming means
        // going back to the menu to keep building the cart, not a details view.
        const typeStr = order.type ? order.type.toLowerCase().replace('_', '-') : 'dine-in';
        router.push(`/pos/order?orderId=${order.id}&edit=true&isHeld=true&tableId=${order.tableId ?? ''}&tableLabel=${order.tableLabel ?? ''}&type=${typeStr}`);
        return;
      }
      // A real, already-submitted order — show the details modal (view +
      // actions) instead of dropping straight into the menu-punching screen.
      setDetailsOrderId(order.id);
      setDetailsOrder(order);
    };

    const ticketLines: TicketLine[] = parsedItems.map((item: any) => {
      const opts = item.options ?? {};
      const modifiers = [opts.variation?.name, ...(Array.isArray(opts.addOns) ? opts.addOns.map((a: any) => a?.name) : [])]
        .filter(Boolean)
        .join(', ');
      return {
        qty: Number(item.quantity || item.qty || 1),
        name: item.name || item.itemName || item.item?.name || 'Item',
        note: item.notes || item.note || null,
        modifiers: modifiers || null,
      };
    });

    const primary: TicketAction | null = dataMode !== 'live' ? null
      : order.heldAt ? { label: 'Resume', tone: 'brand', onClick: onActionClick }
      : isPending && isQR ? { label: 'Confirm order', tone: 'brand', onClick: onActionClick, busy: isUpdatingThis }
      : isPending ? { label: 'Send to kitchen', tone: 'ink', onClick: onActionClick, busy: isUpdatingThis }
      : isInKitchen && useKDS ? { label: 'Cooking', tone: 'quiet', onClick: onActionClick, disabled: true }
      : isInKitchen ? { label: 'Mark ready', tone: 'ink', onClick: onActionClick, busy: isUpdatingThis }
      : isReady ? { label: 'Collect payment', tone: 'brand', onClick: onActionClick }
      : { label: 'View', tone: 'ink', onClick: onActionClick };

    const flags = (isQR || isWhatsApp || hasPaidOnline) ? (
      <span className="flex items-center gap-1 shrink-0">
        {isQR && <span className="h-5 px-1.5 inline-flex items-center gap-1 rounded bg-special/10 text-special text-[10.5px] font-semibold"><QrCode className="w-3 h-3" />QR</span>}
        {isWhatsApp && <span className="h-5 px-1.5 inline-flex items-center gap-1 rounded bg-ok/10 text-ok text-[10.5px] font-semibold"><MessageSquare className="w-3 h-3" />WhatsApp</span>}
        {hasPaidOnline && <span className="h-5 px-1.5 inline-flex items-center rounded bg-ok/10 text-ok text-[10.5px] font-semibold">Paid online</span>}
      </span>
    ) : null;

    const secondary = dataMode === 'history' ? (
      <TicketIconButton title="Reprint receipt" onClick={(e) => handlePrintBill(order, e)} disabled={printingId === order.id}>
        {printingId === order.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Printer className="w-4 h-4" />}
      </TicketIconButton>
    ) : (
      <>
        {!!order.heldAt ? (
          <TicketIconButton title="Delete held order" tone="danger" onClick={(e) => deleteHeldOrder(order.id, e)}>
            <Trash2 className="w-4 h-4" />
          </TicketIconButton>
        ) : (
          <TicketIconButton title="Print bill" onClick={(e) => handlePrintBill(order, e)} disabled={printingId === order.id}>
            {printingId === order.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Printer className="w-4 h-4" />}
          </TicketIconButton>
        )}
        {isWhatsApp && order.customerPhone && (
          <TicketIconButton
            title="Message customer"
            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`, '_blank', 'noopener'); }}
          >
            <MessageSquare className="w-4 h-4" />
          </TicketIconButton>
        )}
      </>
    );

    return (
      <TicketCard
        key={order.id}
        orderNumber={String(order.tokenNumber || order.orderNumber || order.id.slice(-4))}
        type={order.type}
        tableLabel={order.tableLabel}
        status={order.heldAt ? 'HELD' : order.status}
        createdAt={dataMode === 'live' ? timeRef : null}
        lines={ticketLines}
        totalItems={ticketLines.reduce((s, l) => s + l.qty, 0) || order.itemCount || 0}
        total={Number(totalAmount)}
        meta={[
          order.assignedWaiterName && `Waiter ${order.assignedWaiterName.split(' ')[0]}`,
          order.guestCount ? `${order.guestCount} guest${order.guestCount === 1 ? '' : 's'}` : null,
          order.customerName,
        ]}
        flags={flags}
        primary={primary}
        secondary={secondary}
        onOpen={openOrder}
        dimmed={dataMode === 'history'}
        layout={layout === 'list' ? 'list' : 'grid'}
      />
    );
  };

  return (
    <main className="flex-1 bg-canvas overflow-y-auto no-scrollbar font-body-md pb-24 text-ink">
      {/* Toolbar */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface">
        {dataMode === 'live' && <button onClick={() => router.push('/pos/tables')} className="h-11 inline-flex items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white"><Plus size={18} />New order</button>}

        {/* Status filter: one segmented control, each tab with its count, so
            "how many are ready?" is answered without tapping anything. */}
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-sunken border border-line">
            {(dataMode === 'live'
              ? ([
                  ['ALL', 'All', statusCounts.ALL],
                  ['PENDING', 'Pending', statusCounts.PENDING],
                  ['IN_KITCHEN', 'In kitchen', statusCounts.IN_KITCHEN],
                  ['READY', 'Ready', statusCounts.READY],
                  ['HELD', 'On hold', statusCounts.HELD],
                ] as const)
              : ([
                  ['ALL', 'All', null],
                  ['COMPLETED', 'Paid', null],
                  ['CANCELLED', 'Cancelled', null],
                ] as const)
            ).map(([tab, label, n]) => {
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab as any)}
                  className={`h-11 px-3 rounded-lg flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {label}
                  {n !== null && n > 0 && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] tabular-nums ${active ? 'bg-ink text-white' : 'bg-line text-ink-2'}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {dataMode === 'live' && counts.WHATSAPP > 0 && (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'WHATSAPP' ? 'ALL' : 'WHATSAPP')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap border ${
                sourceFilter === 'WHATSAPP'
                  ? 'bg-[#25D366] text-white border-[#25D366] shadow-sm'
                  : 'bg-white border-line text-ink-3 hover:text-ink hover:bg-sunken'
              }`}
            >
              <MessageSquare className="w-[14px] h-[14px]" />
              WhatsApp
              <span className={`px-1.5 rounded-full text-[10px] ${sourceFilter === 'WHATSAPP' ? 'bg-white/20' : 'bg-sunken'}`}>{counts.WHATSAPP}</span>
            </button>
          )}
        </div>

        {/* Right: Search + Sort + View Mode */}
        <div className="flex flex-wrap w-full xl:w-auto min-w-0 items-center gap-2 sm:ml-auto">
          {/* Refreshing over cached data. Inline, not a fixed pill: the pill sat
              at top-right and covered the header clock and avatar. */}
          {isStale && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 pr-1" aria-live="polite">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating
            </span>
          )}
          {(
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                aria-label="Search tickets" placeholder="Find order, table or customer"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="h-11 w-full sm:w-64 bg-surface border border-line hover:border-line-strong focus:border-brand rounded-xl pl-9 pr-3 text-[16px] font-medium text-ink placeholder:text-ink-4 outline-none"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 w-4 h-4" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="h-11 bg-surface border border-line rounded-xl pl-3 pr-8 text-[13px] font-semibold text-ink outline-none appearance-none cursor-pointer hover:border-line-strong"
            >
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
              <option value="table">By table</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none w-4 h-4" />
          </div>
          
          <div className="hidden sm:inline-flex items-center gap-0.5 bg-sunken border border-line p-1 rounded-xl">
            <button onClick={() => handleSetViewMode('grid')} className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'}`} title="Grid View" aria-label="Grid View"><LayoutGrid className="w-[16px] h-[16px]" /></button>
            <button onClick={() => handleSetViewMode('list')} className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'}`} title="List View" aria-label="List View"><Rows3 className="w-[16px] h-[16px]" /></button>
            <button onClick={() => handleSetViewMode('kanban')} className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'}`} title="Kanban View" aria-label="Kanban View"><Columns3 className="w-[16px] h-[16px]" /></button>
          </div>
        </div>
      </div>

        {/* Order Cards Area */}
        <div className="px-4 sm:px-6 pt-5">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[196px] rounded-xl border border-line bg-surface animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && filteredOrders.length === 0 && (
            <div className="py-20 flex flex-col items-center text-center">
              <ServiceIllustration kind="tickets" className="w-32 h-28 mb-3" />
              <p className="text-[15px] font-semibold text-ink">
                {historySearch.trim() ? 'No matching orders' : dataMode === 'history' ? 'No orders in this period' : filter === 'ALL' ? 'You’re up to date' : 'Nothing here right now'}
              </p>
              <p className="text-[13px] text-ink-3 mt-1">
                {historySearch.trim() ? 'Try another order number, table or customer.' : dataMode === 'history' ? 'Try a different date or filter.' : 'New orders will appear here, ready for the next step.'}
              </p>
            </div>
          )}

          {!isLoading && filteredOrders.length > 0 && (viewMode === 'list' || viewMode === 'grid') && !groupByType && (
            viewMode === 'list' ? (
              <div className="flex flex-col gap-3">
                {filteredOrders.map((order: any) => renderCard(order, 'list'))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOrders.map((order: any) => renderCard(order, 'grid'))}
              </div>
            )
          )}

          {!isLoading && filteredOrders.length > 0 && (viewMode === 'list' || viewMode === 'grid') && groupByType && (
            <div className="flex flex-col gap-7">
              {dineInOrders.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-info" />
                    <h3 className="text-[14px] font-semibold text-ink">Dine-in</h3>
                    <span className="text-[13px] text-ink-3 tabular-nums">{dineInOrders.length}</span>
                  </div>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-3">
                      {dineInOrders.map((order: any) => renderCard(order, 'list'))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {dineInOrders.map((order: any) => renderCard(order, 'grid'))}
                    </div>
                  )}
                </section>
              )}

              {otherOrders.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-brand" />
                    <h3 className="text-[14px] font-semibold text-ink">Takeaway &amp; delivery</h3>
                    <span className="text-[13px] text-ink-3 tabular-nums">{otherOrders.length}</span>
                  </div>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-3">
                      {otherOrders.map((order: any) => renderCard(order, 'list'))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {otherOrders.map((order: any) => renderCard(order, 'grid'))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {!isLoading && filteredOrders.length > 0 && viewMode === 'kanban' && (
            <div className="flex gap-8 overflow-x-auto pb-4 hide-scrollbar min-h-[calc(100vh-280px)]">
              {dataMode === 'history' ? (
                // Single Column for History in Kanban mode
                <div className="flex flex-col min-w-[320px] max-w-[400px] flex-1 max-h-[calc(100vh-280px)] overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200 shrink-0">
                    <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Order History</h3>
                    <span className="text-slate-500 text-xs font-bold">{filteredOrders.length}</span>
                  </div>
                  <div className="flex flex-col overflow-y-auto hide-scrollbar flex-1 pb-10 mt-2">
                    {filteredOrders.map((order: any) => renderCard(order, 'kanban'))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Pending Column */}
                  <div className="flex flex-col min-w-[320px] max-w-[350px] flex-1 max-h-[calc(100vh-280px)] overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-yellow-500/20 shrink-0">
                      <h3 className="font-bold text-yellow-500 text-xs uppercase tracking-widest flex items-center gap-2">
                        Pending
                      </h3>
                      <span className="text-yellow-500 text-xs font-bold">{filteredOrders.filter((o: any) => o.status === 'PENDING').length}</span>
                    </div>
                    <div className="flex flex-col overflow-y-auto hide-scrollbar flex-1 pb-10 mt-2">
                      {filteredOrders.filter((o: any) => o.status === 'PENDING').map((order: any) => renderCard(order, 'kanban'))}
                    </div>
                  </div>
                  
                  {/* In Kitchen Column */}
                  <div className="flex flex-col min-w-[320px] max-w-[350px] flex-1 max-h-[calc(100vh-280px)] overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-blue-500/20 shrink-0">
                      <h3 className="font-bold text-blue-400 text-xs uppercase tracking-widest flex items-center gap-2">
                        In Kitchen
                      </h3>
                      <span className="text-blue-400 text-xs font-bold">{filteredOrders.filter((o: any) => o.status === 'IN_KITCHEN').length}</span>
                    </div>
                    <div className="flex flex-col overflow-y-auto hide-scrollbar flex-1 pb-10 mt-2">
                      {filteredOrders.filter((o: any) => o.status === 'IN_KITCHEN').map((order: any) => renderCard(order, 'kanban'))}
                    </div>
                  </div>

                  {/* Ready Column */}
                  <div className="flex flex-col min-w-[320px] max-w-[350px] flex-1 max-h-[calc(100vh-280px)] overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-green-500/20 shrink-0">
                      <h3 className="font-bold text-green-500 text-xs uppercase tracking-widest flex items-center gap-2">
                        Ready
                      </h3>
                      <span className="text-green-500 text-xs font-bold">{filteredOrders.filter((o: any) => o.status === 'READY').length}</span>
                    </div>
                    <div className="flex flex-col overflow-y-auto hide-scrollbar flex-1 pb-10 mt-2">
                      {filteredOrders.filter((o: any) => o.status === 'READY').map((order: any) => renderCard(order, 'kanban'))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      

      {/* Advanced Filter Modal (Minimalist Redesign) */}
      {filterModalOpen && (
        <Modal isOpen label="Ticket filters" onClose={() => setFilterModalOpen(false)} sheetOnMobile className="max-w-[480px] p-5 overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Filters</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={resetFilters} className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider">
                  Reset
                </button>
                <button onClick={() => setFilterModalOpen(false)} aria-label="Close filters" className="w-11 h-11 grid place-items-center text-ink-3 rounded-lg hover:bg-sunken">
                  <X className="w-[20px] h-[20px]" />
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Dashboard Mode */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">View Mode</h3>
                <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl">
                  <button 
                    onClick={() => { setTempDataMode('live'); setTempSearch(''); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all shadow-sm ${tempDataMode === 'live' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                  >
                    Live Tickets
                  </button>
                  <button 
                    onClick={() => setTempDataMode('history')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all shadow-sm ${tempDataMode === 'history' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                  >
                    Order History
                  </button>
                </div>
              </div>

              {/* Order Type Filter (Live Only) */}
              {tempDataMode === 'live' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Order Type</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['ALL', 'DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ON_HOLD'] as const).map(option => (
                      <button 
                        key={option}
                        onClick={() => setTempFilter(option)}
                        className={`py-3 px-2 rounded-xl border flex items-center justify-center transition-all ${tempFilter === option ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm font-bold capitalize">{option.replace('_', ' ').toLowerCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiter Filter */}
              {waiters.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Waiter</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button 
                      onClick={() => setTempWaiterFilter('ALL')}
                      className={`py-2 px-2 rounded-xl border flex items-center justify-center transition-all ${tempWaiterFilter === 'ALL' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="text-sm font-bold capitalize">All Waiters</span>
                    </button>
                    {waiters.map(waiter => (
                      <button 
                        key={waiter.id}
                        onClick={() => setTempWaiterFilter(waiter.id)}
                        className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${tempWaiterFilter === waiter.id ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm font-bold truncate max-w-full px-1">{waiter.name}</span>
                        {waiter.waiterNumber && <span className="text-[10px] opacity-70">W-{waiter.waiterNumber}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* History Search (History Only) */}
              {tempDataMode === 'history' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search History</h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-[20px] h-[20px]" />
                    <input 
                      type="text" 
                      placeholder="e.g. Table T-5 or #1024"
                      value={tempSearch}
                      onChange={e => setTempSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          applyFilters();
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-sm"
                    />
                  </div>
                </div>
              )}

              {/* Sorting (Live Only) */}
              {tempDataMode === 'live' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sort By</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(['oldest', 'newest', 'table'] as const).map(option => (
                      <button 
                        key={option}
                        onClick={() => setTempSortOrder(option)}
                        className={`py-3 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${tempSortOrder === option ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {option === 'oldest' ? <Clock className="w-[18px] h-[18px]" /> : option === 'newest' ? <Zap className="w-[18px] h-[18px]" /> : <Armchair className="w-[18px] h-[18px]" />}
                        <span className="text-xs font-bold capitalize">{option === 'table' ? 'By Table' : option}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <button 
                onClick={applyFilters}
                className="w-full py-4 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-strong active:scale-[0.98] transition-all shadow-sm"
              >
                Apply Changes
              </button>
            </div>
        </Modal>
      )}

      {/* Shift Summary Modal.
          z-[500], not 9999 — that value tied exactly with ConfirmModal's
          real (inline-style) z-index, so if a confirm dialog is ever
          triggered from within this view, which one paints on top would
          have been decided by DOM order, not intent. ConfirmModal is meant
          to out-rank everything, including this. */}
      {shiftSummaryOpen && (
        <Modal isOpen label="Shift summary" onClose={() => setShiftSummaryOpen(false)} className="max-w-sm p-5 overflow-y-auto">
            <h2 className="text-xl font-semibold text-slate-900 mb-2 tracking-tight">Your Shift: {isMounted ? (session.cashierName || 'Cashier') : 'Cashier'}</h2>
            <div className="text-slate-600 space-y-3 my-6 text-sm font-medium">
              <p className="flex justify-between"><span>Duration</span> <span className="text-slate-900 font-bold">{shiftElapsed}</span></p>
              <p className="flex justify-between"><span>Orders today</span> <span className="text-slate-900 font-bold">{orders.length}</span></p>
            </div>
            <button 
              onClick={() => { setShiftSummaryOpen(false); router.push('/pos/shift/close'); }}
              className="mt-2 w-full font-bold py-3.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm"
            >
              Close Shift
            </button>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!deleteHeldTarget}
        title="Delete Held Order?"
        message="This held order will be permanently removed and can't be resumed."
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDeleteHeldOrder}
        onCancel={() => setDeleteHeldTarget(null)}
      />

      <OrderDetailsModal
        orderId={detailsOrderId}
        initialOrder={detailsOrder}
        onClose={() => { setDetailsOrderId(null); setDetailsOrder(null); }}
        useKDS={useKDS}
        readOnly={dataMode === 'history'}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['swr-active-orders'] })}
      />
    </main>
  );
}
