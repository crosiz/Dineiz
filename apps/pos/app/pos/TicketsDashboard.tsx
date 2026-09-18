'use client';

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
import { markReady, sendToKitchen, requestBill } from '@/lib/core/commands';
import { toast } from 'sonner';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { OrderTypeBadge } from '@/components/OrderTypeBadge';
import { API_URL } from '@/lib/api';
import { Armchair, ChevronDown, CircleUser, Clock, Columns3, LayoutGrid, ListFilter, Loader2, MessageSquare, Plus, Printer, QrCode, Rows3, Search, User, X, Zap } from 'lucide-react';

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
  const [useKDS, setUseKDS] = useState<boolean>(() => {
    try {
      const tenantWide = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}')?.kitchen?.useKDS ?? false;
      const branchLevel = JSON.parse(localStorage.getItem('pos_branding') || '{}')?.branchKdsEnabled ?? false;
      return tenantWide && branchLevel;
    } catch {}
    return false;
  });

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
  
  // Ticket operations work best as a stable queue. A card grid and kanban
  // board made 50+ orders taller, reordered the same ticket between views and
  // hid key data behind visual chrome. Keep those legacy render branches for
  // compatibility, but this screen now always opens in its scan-friendly list.
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

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
  const isLoading = dataMode === 'history' && isFetching && orders.length === 0;

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

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (dataMode === 'history') return orders;

    const bySource = (list: any[]) => (sourceFilter === 'ALL' ? list : list.filter((o: any) => o.source === sourceFilter));

    const nonCompleted = orders.filter((o: any) => o.status !== 'COMPLETED');
    if (filter === 'ALL') return bySource(nonCompleted);
    if (filter === 'ON_HOLD' || filter === 'HELD') return bySource(heldOrders);

    // Check if filter is an order status
    if (['PENDING', 'IN_KITCHEN', 'READY'].includes(filter)) {
      return bySource(nonCompleted.filter((o: any) => o.status === filter));
    }

    // Otherwise it's an order type (DINE_IN, TAKEAWAY, DELIVERY)
    return bySource(nonCompleted.filter((o: any) => o.type === filter));
  }, [orders, filter, heldOrders, dataMode, sourceFilter]);

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

  useEffect(() => {
    if (!socket || !session.branchId) return;
    // order:created/status_changed/cancelled → lib/core/views.ts's shared
    // store is now what live orders render from, and POSLayout.tsx already
    // refreshes it centrally on these same events (so every screen stays in
    // sync, not just this one) — no per-screen listener needed here anymore.
    // Listen for tenant settings updates (e.g. useKDS toggled from admin)
    const handleSettingsUpdate = (settings: any) => {
      if (settings?.kitchen?.useKDS !== undefined) {
        // Keep OR'd with this branch's own KDS flag — a live tenant-wide
        // toggle-off shouldn't turn off a branch that has its own KDS
        // hardware configured.
        let branchLevel = false;
        try {
          branchLevel = JSON.parse(localStorage.getItem('pos_branding') || '{}')?.branchKdsEnabled ?? false;
        } catch {}
        setUseKDS(settings.kitchen.useKDS || branchLevel);
        try {
          const stored = localStorage.getItem('pos_tenant_settings');
          const parsed = stored ? JSON.parse(stored) : {};
          parsed.kitchen = { ...parsed.kitchen, useKDS: settings.kitchen.useKDS };
          localStorage.setItem('pos_tenant_settings', JSON.stringify(parsed));
        } catch {}
      }
    };

    socket.emit('join_branch', session.branchId);
    socket.on('tenant:settings_updated', handleSettingsUpdate);

    return () => {
      socket.off('tenant:settings_updated', handleSettingsUpdate);
    };
  }, [socket, session.branchId]);

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
        await requestBill(order.id);
      }
    } catch (err: any) {
      console.warn('Failed to print bill', err);
      toast.error(err?.message || 'Failed to print bill');
    } finally {
      setPrintingId(null);
    }
  };

  const renderCard = (order: any) => {
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
      try { rawItems = typeof order.cart === 'string' ? JSON.parse(order.cart) : (order.cart || []); } catch { rawItems = []; }
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
    const itemSummary = parsedItems.length === 0
      ? `${order.itemCount || 0} items`
      : `${parsedItems.slice(0, 2).map((i: any) => `${i.quantity || i.qty}× ${i.name || i.itemName || i.item?.name || 'Item'}`).join(' · ')}${parsedItems.length > 2 ? ` · +${parsedItems.length - 2} more` : ''}`;

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

    const quantity = parsedItems.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0);
    return (
      <article key={order.id} data-testid="ticket-card" className="rounded-xl border border-line bg-surface overflow-hidden">
        <button onClick={openOrder} className="w-full text-left p-4 focus-visible:ring-inset hover:bg-sunken/60 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink break-words">#{order.tokenNumber || order.orderNumber || order.id.slice(-4)}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <OrderTypeBadge type={order.type || order.orderType} />
                {order.tableLabel && <span className="font-medium text-ink">Table {order.tableLabel}</span>}
                {order.assignedWaiterName && <span>{order.assignedWaiterName}</span>}
                {isQR && <span>QR order</span>}
                {isWhatsApp && <span>WhatsApp</span>}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <StatusBadge status={order.heldAt ? 'HELD' : order.status} />
              {dataMode === 'live' && <TicketTimer createdAt={timeRef} />}
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-2 line-clamp-2 leading-6">{itemSummary}</p>
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="text-ink-3">{quantity || order.itemCount || 0} items · View details</span>
            <span className="font-semibold text-ink tabular-nums">{formatPKR(totalAmount)}</span>
          </div>
          {hasPaidOnline && <p className="mt-2 text-xs font-medium text-ok">Paid online</p>}
        </button>
        <div className="flex items-center gap-2 border-t border-line bg-sunken/40 px-3 py-2">
          {order.heldAt ? (
            <button onClick={(e) => deleteHeldOrder(order.id, e)} className="min-h-11 px-3 rounded-lg text-sm font-medium text-danger hover:bg-danger/10">Delete draft</button>
          ) : (
            <button onClick={(e) => handlePrintBill(order, e)} disabled={printingId === order.id} className="min-h-11 px-3 rounded-lg text-sm font-medium text-ink-2 flex items-center gap-2 hover:bg-hover disabled:opacity-50">
              {printingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              {dataMode === 'history' ? 'Reprint' : 'Print bill'}
            </button>
          )}
          {dataMode === 'live' && (
            <button disabled={!!isUpdatingThis || (isInKitchen && useKDS)} onClick={order.heldAt ? openOrder : onActionClick}
              className="ml-auto min-h-11 rounded-lg px-4 text-sm font-semibold bg-brand text-white hover:brightness-95 disabled:bg-sunken disabled:text-ink-3">
              {isUpdatingThis ? 'Saving…' : order.heldAt ? 'Resume order' : isPending ? 'Send to kitchen' : isInKitchen && useKDS ? 'Preparing in kitchen' : isInKitchen ? 'Mark ready' : isReady ? 'Collect payment' : 'View order'}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <main className="flex-1 bg-canvas overflow-y-auto no-scrollbar font-body-md pb-24 text-ink">
      {/* Background sync pill — only visible while network is fetching over cached data */}
      {isStale && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-line shadow-sm text-[11px] font-bold text-ink-3 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Syncing
        </div>
      )}
      {/* Sub-header Toolbar */}
      <div className="px-3 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-line">
        
        {/* Left: Filter Buttons / Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {dataMode === 'live' ? (
            ['ALL', 'PENDING', 'IN_KITCHEN', 'READY', 'HELD'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab as any)}
                className={`min-h-11 px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap border ${
                  filter === tab
                    ? 'bg-brand text-white border-brand shadow-sm'
                    : 'bg-white border-line text-ink-3 hover:text-ink hover:bg-sunken'
                }`}
              >
                {({ ALL: 'All orders', PENDING: 'New', IN_KITCHEN: 'Preparing', READY: 'Ready', HELD: 'On hold' } as Record<string, string>)[tab]}
              </button>
            ))
          ) : (
            ['ALL', 'COMPLETED', 'CANCELLED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab as any)}
                className={`min-h-11 px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap border ${
                  filter === tab
                    ? 'bg-brand text-white border-brand shadow-sm'
                    : 'bg-white border-line text-ink-3 hover:text-ink hover:bg-sunken'
                }`}
              >
                {tab === 'ALL' ? 'All History' : tab}
              </button>
            ))
          )}
          {dataMode === 'live' && counts.WHATSAPP > 0 && (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'WHATSAPP' ? 'ALL' : 'WHATSAPP')}
              className={`flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap border ${
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
        <div className="flex flex-wrap items-center gap-3">
          {dataMode === 'history' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search ticket #, customer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-white border border-line-strong focus:border-brand rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-ink placeholder:text-ink-4 outline-none shadow-sm"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 w-[16px] h-[16px]" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              aria-label="Sort tickets"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-white border border-line-strong rounded-lg min-h-11 px-3 py-2 text-sm font-medium text-ink outline-none appearance-none pr-8 shadow-sm cursor-pointer"
            >
              <option value="oldest">Oldest First</option>
              <option value="newest">Newest First</option>
              <option value="table">By Table</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none w-[18px] h-[18px]" />
          </div>
          
        </div>
      </div>

        {/* Order Cards Area */}
        <div className="px-3 sm:px-6 mt-4">
          {/* History-only first-load spinner — live always shows cached data instantly */}
          {isLoading && <div className="text-ink-4 text-center py-10 font-medium">Loading order history...</div>}
          {!isLoading && filteredOrders.length === 0 && <div className="text-ink-4 text-center py-10 font-medium">No orders found.</div>}

          {!isLoading && filteredOrders.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
              {filteredOrders.map((order: any) => renderCard(order))}
            </div>
          )}
        </div>
      
      {/* Advanced Filter Modal (Minimalist Redesign) */}
      {filterModalOpen && (
        <div className="fixed top-0 left-0 w-[100vw] h-[100vh] z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" style={{ position: 'fixed', margin: 0 }} onClick={() => setFilterModalOpen(false)}>
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl w-[90vw] min-w-[320px] sm:min-w-[450px] max-w-[480px] p-6 sm:p-8 flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Filters</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={resetFilters} className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider">
                  Reset
                </button>
                <button onClick={() => setFilterModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full p-1">
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
                        {option === 'oldest' ? 'schedule' : option === 'newest' ? <Zap className="w-[18px] h-[18px]" /> : <Armchair className="w-[18px] h-[18px]" />}
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
                className="w-full py-4 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all shadow-sm"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal.
          z-[500], not 9999 — that value tied exactly with ConfirmModal's
          real (inline-style) z-index, so if a confirm dialog is ever
          triggered from within this view, which one paints on top would
          have been decided by DOM order, not intent. ConfirmModal is meant
          to out-rank everything, including this. */}
      {shiftSummaryOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShiftSummaryOpen(false)}>
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl w-full max-w-sm p-8 flex flex-col text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Your Shift: {isMounted ? (session.cashierName || 'Cashier') : 'Cashier'}</h2>
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
          </div>
        </div>
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
