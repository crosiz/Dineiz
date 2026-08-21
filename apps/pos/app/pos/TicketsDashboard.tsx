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
import { toast } from 'sonner';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { OrderDetailsModal } from './OrderDetailsModal';

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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
        <button onClick={openFilterModal} className={`flex items-center justify-center rounded-xl h-[42px] w-[42px] transition-all border shadow-sm ${dataMode === 'history' ? 'bg-[var(--pos-primary)] border-[var(--pos-primary)] text-white' : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`} title="Advanced Filter & History">
          <span className="material-symbols-outlined transition-colors" style={{ fontSize: '22px' }}>filter_list</span>
        </button>
        <button onClick={() => setShiftSummaryOpen(true)} className="flex items-center justify-center rounded-xl h-[42px] w-[42px] bg-white hover:bg-[#F8FAFC] transition-all border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] shadow-sm" title="Shift Summary">
          <span className="material-symbols-outlined transition-colors" style={{ fontSize: '22px' }}>schedule</span>
        </button>
        <button onClick={() => setMyOrdersOnly(!myOrdersOnly)} className={`flex items-center justify-center rounded-xl h-[42px] w-[42px] transition-all border shadow-sm ${myOrdersOnly ? 'bg-[#0F172A] border-[#0F172A] text-white' : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`} title="My Orders">
          <span className="material-symbols-outlined transition-colors" style={{ fontSize: '22px' }}>account_circle</span>
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const { orders, isFetching, isStale } = useSWROrders({
    branchId: session.branchId,
    dataMode,
    myOrdersOnly,
    cashierId: session.cashierId,
    waiterId: waiterFilter,
    sortOrder,
    historySearch,
    refetchIntervalMs: 15_000,
  });

  // For history mode: show a spinner only on the very first load (no IDB data yet)
  // For live mode: never block — IDB data renders instantly, network runs silently
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
    // On any real-time order event: invalidate SWR cache so background refresh fires
    const handleOrderUpdate = () => {
      if (dataMode === 'live') {
        queryClient.invalidateQueries({ queryKey: ['swr-active-orders'] });
      }
    };
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
    socket.on('order:created', handleOrderUpdate);
    socket.on('order:status_changed', handleOrderUpdate);
    socket.on('order:cancelled', handleOrderUpdate);
    socket.on('tenant:settings_updated', handleSettingsUpdate);

    return () => {
      socket.off('order:created', handleOrderUpdate);
      socket.off('order:status_changed', handleOrderUpdate);
      socket.off('order:cancelled', handleOrderUpdate);
      socket.off('tenant:settings_updated', handleSettingsUpdate);
    };
  }, [socket, session.branchId, queryClient, dataMode]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setIsUpdating(orderId);
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      queryClient.invalidateQueries({ queryKey: ['swr-active-orders'] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(null);
    }
  };

  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
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
    
    let parsedItems: any[] = [];
    if (order.cart) {
      parsedItems = typeof order.cart === 'string' ? JSON.parse(order.cart) : (order.cart || []);
    } else if (typeof order.items === 'string') {
      try { parsedItems = JSON.parse(order.items); } catch(e) {}
    } else {
      parsedItems = order.items || [];
    }

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
        const nextStatus = useKDS ? 'IN_KITCHEN' : 'READY';
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
    };

    if (layout === 'list') {
      return (
        <div key={order.id} onClick={openOrder} className={`flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl transition-all shadow-sm min-w-0 cursor-pointer hover:border-[#CBD5E1] ${isWhatsApp ? 'border-l-4 border-l-[#25D366]' : ''} ${dataMode === 'history' ? 'opacity-80' : ''}`}>
          <div className="flex-1 flex items-center gap-4 sm:gap-6 min-w-0">
            <div className="w-16 shrink-0">
              <span className="text-xl font-bold text-[#0F172A]">#{order.tokenNumber || order.orderNumber || order.id.slice(-4)}</span>
            </div>
            {order.tableLabel && (
              <div className="shrink-0 hidden sm:block">
                <span className={`font-bold border px-2 py-1 rounded ${isReady ? 'text-sm text-green-700 bg-green-50 border-green-200' : 'text-xs text-[#64748B] bg-[#F8FAFC] border-[#E2E8F0]'}`}>T-{order.tableLabel}</span>
              </div>
            )}
            {order.assignedWaiterName && (
              <div className="shrink-0 hidden sm:block">
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">person</span>
                  {order.assignedWaiterName}
                </div>
              </div>
            )}
            <div className="w-20 shrink-0 hidden sm:block">
              <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-1 rounded-md uppercase">{typeLabel}</span>
            </div>
            <div className="flex-1 truncate text-[#475569] text-sm min-w-0 font-medium">
              {parsedItems.length > 0 ? parsedItems.map((i:any) => `${i.quantity || i.qty}x ${i.name || i.itemName || i.item?.name}`).join(', ') : `${order.itemCount || 0} items`}
            </div>
            <div className="w-24 text-right shrink-0">
              <span className="text-[#0F172A] font-bold text-sm">{formatPKR(totalAmount)}</span>
            </div>
            <div className="flex justify-end shrink-0 gap-2">
              {dataMode === 'history' ? (
                <button
                  onClick={(e) => handlePrintBill(order, e)}
                  disabled={printingId === order.id}
                  title="Reprint Receipt"
                  className="flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-bold tracking-wide bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
                  Reprint
                </button>
              ) : (
                <>
                  {hasPaidOnline && (
                    <div className="px-2 py-1 rounded border text-[11px] font-bold tracking-wide bg-green-50 text-green-700 border-green-200">
                      PAID ONLINE
                    </div>
                  )}
                  <StatusBadge status={order.status} />
                  <TicketTimer createdAt={timeRef} />
                </>
              )}
            </div>
          </div>
          {dataMode === 'live' && (
            <div className="w-full sm:w-auto mt-2 sm:mt-0 shrink-0 flex gap-2">
              {!!order.heldAt && (
                <button
                  onClick={(e) => deleteHeldOrder(order.id, e)}
                  className="px-4 py-2 rounded-lg font-semibold text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              )}
              {!order.heldAt && (
                <button
                  onClick={(e) => handlePrintBill(order, e)}
                  disabled={printingId === order.id}
                  title="Print Bill"
                  className="px-3 py-2 rounded-lg font-semibold text-sm bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
                  <span className="hidden md:inline">Bill</span>
                </button>
              )}
              {isWhatsApp && order.customerPhone && (
                <a
                  href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Message Customer"
                  className="px-3 py-2 rounded-lg font-semibold text-sm bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  <span className="hidden md:inline">Message</span>
                </a>
              )}
              <button disabled={isUpdatingThis || (isInKitchen && useKDS)} onClick={onActionClick} className={`w-full sm:w-auto px-6 py-2 rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2 ${isReady ? 'bg-orange-500 text-white hover:bg-orange-600' : isPending ? 'bg-orange-500 text-white hover:bg-orange-600' : (isInKitchen && useKDS) ? 'bg-blue-100 text-blue-600 cursor-not-allowed' : isInKitchen ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] hover:bg-[#E2E8F0]'}`}>
                {isUpdatingThis ? 'Updating...' : !!order.heldAt ? 'Resume' : (isPending && isQR) ? 'Confirm Order' : isPending ? (useKDS ? 'Send to Kitchen' : 'Mark Ready') : (isInKitchen && useKDS) ? 'In Kitchen (KDS)...' : isInKitchen ? 'Mark Ready' : isReady ? 'Collect Payment' : 'View Order'}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (layout === 'kanban') {
      return (
        <div key={order.id} onClick={openOrder} className="flex flex-col py-3 border-b border-[#E2E8F0] group shrink-0 w-full cursor-pointer hover:bg-white hover:shadow-sm px-3 rounded-xl transition-all">
          <div className="flex justify-between items-start mb-2 w-full gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-[#0F172A] tracking-tight">#{order.tokenNumber || order.orderNumber || order.id.slice(-4)}</span>
              {order.tableLabel && <span className={`font-bold border px-1.5 py-0.5 rounded shrink-0 ${isReady ? 'text-xs text-green-700 bg-green-50 border-green-200' : 'text-[10px] text-[#64748B] bg-[#F8FAFC] border-[#E2E8F0]'}`}>T-{order.tableLabel}</span>}
              <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded uppercase shrink-0">{typeLabel}</span>
              {order.assignedWaiterName && (
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                  <span className="material-symbols-outlined text-[10px]">person</span>
                  {order.assignedWaiterName.split(' ')[0]}
                </div>
              )}
              {isQR && (
                <div className="flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                  <span className="material-symbols-outlined text-[10px]">qr_code_2</span>
                  QR
                </div>
              )}
              {isWhatsApp && (
                <div className="flex items-center gap-1 bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/30 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                  <span className="material-symbols-outlined text-[10px]">chat</span>
                  WhatsApp
                </div>
              )}
            </div>
            <div className="flex justify-end gap-1 shrink-0">
              {dataMode === 'history' ? (
                <div className="px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-wide bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]">
                  {order.status}
                </div>
              ) : (
                <>
                  {hasPaidOnline && (
                    <div className="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide bg-green-50 text-green-700 border-green-200">
                      PAID ONLINE
                    </div>
                  )}
                  <StatusBadge status={order.status} />
                  <TicketTimer createdAt={timeRef} />
                </>
              )}
            </div>
          </div>
          
          <div className="mb-2 w-full">
            {parsedItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start text-[11px] leading-relaxed py-0.5 w-full gap-2">
                <div className="flex gap-2 flex-1 min-w-0">
                  <span className="text-[#64748B] font-bold shrink-0">{item.quantity || item.qty}x</span>
                  <span className="text-[#475569] font-medium truncate">
                    {(item as any).name || (item as any).itemName || (item as any).item?.name}
                  </span>
                </div>
              </div>
            ))}
            {parsedItems.length === 0 && (
              <div className="text-xs text-[#64748B] font-medium py-1">{order.itemCount || 0} Items</div>
            )}
          </div>
          
          {dataMode === 'live' && (
            <div className="flex justify-between items-center mt-1 opacity-80 group-hover:opacity-100 transition-opacity gap-2">
              <span className="text-[#0F172A] font-bold text-[12px]">{formatPKR(totalAmount)}</span>
              <div className="flex gap-2">
                {!!order.heldAt && (
                  <button
                    onClick={(e) => deleteHeldOrder(order.id, e)}
                    className="text-[10px] font-bold transition-colors px-3 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                )}
                {!order.heldAt && (
                  <button
                    onClick={(e) => handlePrintBill(order, e)}
                    disabled={printingId === order.id}
                    title="Print Bill"
                    className="flex items-center justify-center w-7 h-7 rounded-md bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
                  </button>
                )}
                {isWhatsApp && order.customerPhone && (
                  <a
                    href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Message Customer"
                    className="flex items-center justify-center w-7 h-7 rounded-md bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">chat</span>
                  </a>
                )}
                <button
                  disabled={isUpdatingThis || (isInKitchen && useKDS)}
                  onClick={onActionClick}
                  className={`text-[10px] font-bold transition-colors px-3 py-1.5 rounded-md ${isReady ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : isPending ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : (isInKitchen && useKDS) ? 'bg-blue-50 text-blue-600 cursor-not-allowed' : isInKitchen ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-white border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}`}
                >
                  {isUpdatingThis ? '...' : !!order.heldAt ? 'Resume' : isPending ? (useKDS ? 'Send to Kitchen' : 'Mark Ready') : (isInKitchen && useKDS) ? 'In KDS...' : isInKitchen ? 'Mark Ready' : isReady ? 'Collect' : 'View Order'}
                </button>
              </div>
            </div>
          )}
          {dataMode === 'history' && (
            <div className="flex justify-between items-center mt-1 opacity-80 group-hover:opacity-100 transition-opacity gap-2">
              <span className="text-[#0F172A] font-bold text-[12px]">{formatPKR(totalAmount)}</span>
              <button
                onClick={(e) => handlePrintBill(order, e)}
                disabled={printingId === order.id}
                title="Reprint Receipt"
                className="flex items-center justify-center w-7 h-7 rounded-md bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={order.id} onClick={openOrder} className={`flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden transition-all group h-full cursor-pointer hover:border-[#CBD5E1] hover:shadow-md ${isWhatsApp ? 'border-l-4 border-l-[#25D366]' : ''} ${dataMode === 'history' ? 'opacity-90' : ''}`}>
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-2xl font-black text-[#0F172A] tracking-tight">#{order.tokenNumber || order.orderNumber || order.id.slice(-4)}</span>
              {order.tableLabel && <span className={`ml-2 font-bold border px-2 py-0.5 rounded ${isReady ? 'text-green-700 bg-green-50 border-green-200 text-base' : 'text-sm text-[#64748B] bg-[#F8FAFC] border-[#E2E8F0]'}`}>Table {order.tableLabel}</span>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {dataMode === 'history' ? (
                <button
                  onClick={(e) => handlePrintBill(order, e)}
                  disabled={printingId === order.id}
                  title="Reprint Receipt"
                  className="flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-bold tracking-wide bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
                  Reprint
                </button>
              ) : (
                <>
                  <StatusBadge status={order.status} />
                  <TicketTimer createdAt={timeRef} />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4 mt-[-4px]">
            <span className="text-xs font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-1 rounded-md uppercase tracking-wider">{typeLabel}</span>
            {order.assignedWaiterName && (
              <div className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-[10px] font-bold">
                <span className="material-symbols-outlined text-[12px]">person</span>
                {order.assignedWaiterName}
              </div>
            )}
          </div>
          
          <div className="space-y-2.5 mb-6 flex-1">
            {parsedItems.slice(0, 4).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm leading-tight">
                <span className="text-[#475569] font-medium truncate pr-2">
                  <span className="text-[#64748B] mr-1.5 font-bold">{item.quantity || item.qty}x</span>
                  {(item as any).name || (item as any).itemName || (item as any).item?.name}
                </span>
              </div>
            ))}
            {parsedItems.length > 4 && (
              <div className="text-[11px] text-[#64748B] font-bold tracking-wide pt-1">
                + {parsedItems.length - 4} MORE ITEMS
              </div>
            )}
            {parsedItems.length === 0 && (
              <div className="text-sm text-[#475569] font-medium py-1">{order.itemCount || 0} Items included in this order</div>
            )}
          </div>
          
          <div className="flex justify-between items-end pt-4 border-t border-[#F1F5F9]">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-[#64748B] font-bold tracking-wider mb-0.5">Total Amount</span>
              <span className="text-lg font-black text-[#0F172A] tracking-tight">{formatPKR(totalAmount)}</span>
            </div>
            {dataMode === 'history' && (
              <span className="text-xs font-bold text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-1 rounded uppercase tracking-wider">
                {order.status}
              </span>
            )}
          </div>
        </div>
        
        {dataMode === 'live' && (
          <div className="flex border-t border-[#E2E8F0] bg-[#F8FAFC]">
            {!!order.heldAt && (
              <button
                onClick={(e) => deleteHeldOrder(order.id, e)}
                className="w-1/3 py-3.5 text-sm font-bold transition-colors flex justify-center items-center text-red-600 hover:bg-red-50 border-r border-[#E2E8F0]"
              >
                Delete
              </button>
            )}
            {!order.heldAt && (
              <button
                onClick={(e) => handlePrintBill(order, e)}
                disabled={printingId === order.id}
                title="Print Bill"
                className="w-14 py-3.5 flex justify-center items-center text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors border-r border-[#E2E8F0] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{printingId === order.id ? 'hourglass_top' : 'print'}</span>
              </button>
            )}
            {isWhatsApp && order.customerPhone && (
              <a
                href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Message Customer"
                className="w-14 py-3.5 flex justify-center items-center text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors border-r border-[#E2E8F0]"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
              </a>
            )}
            <button
              disabled={isUpdatingThis || (isInKitchen && useKDS)}
              onClick={onActionClick}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors flex justify-center items-center gap-2 ${isReady ? 'bg-orange-500 text-white hover:bg-orange-600' : isPending ? 'bg-orange-500 text-white hover:bg-orange-600' : (isInKitchen && useKDS) ? 'bg-blue-100 text-blue-600 cursor-not-allowed' : isInKitchen ? 'bg-green-500 text-white hover:bg-green-600' : 'text-[#0F172A] hover:bg-[#E2E8F0]'}`}
            >
              {isUpdatingThis ? 'Updating...' : !!order.heldAt ? 'Resume Order' : isPending ? (useKDS ? 'Send to Kitchen' : 'Mark Ready') : (isInKitchen && useKDS) ? 'In Kitchen (KDS)...' : isInKitchen ? 'Mark Ready' : isReady ? 'Collect Payment' : 'View Order'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="flex-1 bg-[#F8FAFC] overflow-y-auto no-scrollbar font-body-md pb-24 text-[#0F172A]">
      {/* Background sync pill — only visible while network is fetching over cached data */}
      {isStale && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-[#E2E8F0] shadow-sm text-[11px] font-bold text-[#64748B] pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Syncing
        </div>
      )}
      {/* Sub-header Toolbar */}
      <div className="px-8 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0]">
        
        {/* Left: Filter Buttons / Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {dataMode === 'live' ? (
            ['ALL', 'PENDING', 'IN_KITCHEN', 'READY', 'HELD'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab as any)}
                className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap border ${
                  filter === tab
                    ? 'bg-[var(--pos-primary,#F59E0B)] text-white border-[var(--pos-primary,#F59E0B)] shadow-sm'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                {tab === 'ALL' ? 'All Live' : tab.replace('_', ' ')}
              </button>
            ))
          ) : (
            ['ALL', 'COMPLETED', 'CANCELLED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab as any)}
                className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap border ${
                  filter === tab
                    ? 'bg-[var(--pos-primary,#F59E0B)] text-white border-[var(--pos-primary,#F59E0B)] shadow-sm'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                {tab === 'ALL' ? 'All History' : tab}
              </button>
            ))
          )}
          {dataMode === 'live' && counts.WHATSAPP > 0 && (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'WHATSAPP' ? 'ALL' : 'WHATSAPP')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap border ${
                sourceFilter === 'WHATSAPP'
                  ? 'bg-[#25D366] text-white border-[#25D366] shadow-sm'
                  : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">chat</span>
              WhatsApp
              <span className={`px-1.5 rounded-full text-[10px] ${sourceFilter === 'WHATSAPP' ? 'bg-white/20' : 'bg-[#F1F5F9]'}`}>{counts.WHATSAPP}</span>
            </button>
          )}
        </div>

        {/* Right: Search + Sort + View Mode */}
        <div className="flex items-center gap-3 ml-auto">
          {dataMode === 'history' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search ticket #, customer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-white border border-[#CBD5E1] focus:border-[var(--pos-primary,#F59E0B)] rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-[#0F172A] placeholder:text-[#94A3B8] outline-none shadow-sm"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] text-[16px]">
                search
              </span>
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] outline-none appearance-none pr-8 shadow-sm cursor-pointer"
            >
              <option value="oldest">Oldest First</option>
              <option value="newest">Newest First</option>
              <option value="table">By Table</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none text-[18px]">
              expand_more
            </span>
          </div>
          
          <div className="hidden sm:flex items-center bg-[#F1F5F9] border border-[#CBD5E1] p-1 rounded-xl">
            <button onClick={() => handleSetViewMode('grid')} className={`w-8 h-6 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`} title="Grid View"><span className="material-symbols-outlined text-[16px]">grid_view</span></button>
            <button onClick={() => handleSetViewMode('list')} className={`w-8 h-6 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`} title="List View"><span className="material-symbols-outlined text-[16px]">view_list</span></button>
            <button onClick={() => handleSetViewMode('kanban')} className={`w-8 h-6 flex items-center justify-center rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`} title="Kanban View"><span className="material-symbols-outlined text-[16px]">view_week</span></button>
          </div>
        </div>
      </div>

        {/* Order Cards Area */}
        <div className="px-8 mt-2">
          {/* History-only first-load spinner — live always shows cached data instantly */}
          {isLoading && <div className="text-[#94A3B8] text-center py-10 font-medium">Loading order history...</div>}
          {!isLoading && filteredOrders.length === 0 && <div className="text-[#94A3B8] text-center py-10 font-medium">No orders found.</div>}

          {!isLoading && filteredOrders.length > 0 && (viewMode === 'list' || viewMode === 'grid') && !groupByType && (
            viewMode === 'list' ? (
              <div className="flex flex-col gap-3">
                {filteredOrders.map((order: any) => renderCard(order, 'list'))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredOrders.map((order: any) => renderCard(order, 'grid'))}
              </div>
            )
          )}

          {!isLoading && filteredOrders.length > 0 && (viewMode === 'list' || viewMode === 'grid') && groupByType && (
            <div className="flex flex-col gap-9">
              {dineInOrders.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-2 h-2 rounded-full bg-[#2A5DB0]" />
                    <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">Dine-In</h3>
                    <span className="text-[12px] font-bold text-[#94A3B8]">{dineInOrders.length} table{dineInOrders.length === 1 ? '' : 's'}</span>
                    <div className="h-px flex-1 bg-[#E2E8F0]" />
                  </div>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-3">
                      {dineInOrders.map((order: any) => renderCard(order, 'list'))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {dineInOrders.map((order: any) => renderCard(order, 'grid'))}
                    </div>
                  )}
                </section>
              )}

              {otherOrders.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-2 h-2 rounded-full bg-[var(--pos-primary,#F59E0B)]" />
                    <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">Takeaway &amp; Delivery</h3>
                    <span className="text-[12px] font-bold text-[#94A3B8]">{otherOrders.length} waiting</span>
                    <div className="h-px flex-1 bg-[#E2E8F0]" />
                  </div>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-3">
                      {otherOrders.map((order: any) => renderCard(order, 'list'))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
      
      {dataMode === 'live' && (
        <button
          onClick={() => router.push('/pos/tables')}
          className="fixed right-6 bottom-24 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50"
        >
          <span className="material-symbols-outlined text-[32px]">add</span>
        </button>
      )}

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
                  <span className="material-symbols-outlined text-[20px]">close</span>
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
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
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
                        <span className="material-symbols-outlined text-[18px]">
                          {option === 'oldest' ? 'schedule' : option === 'newest' ? 'bolt' : 'table_restaurant'}
                        </span>
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

      {/* Shift Summary Modal */}
      {shiftSummaryOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShiftSummaryOpen(false)}>
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
        onClose={() => setDetailsOrderId(null)}
        useKDS={useKDS}
        readOnly={dataMode === 'history'}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['swr-active-orders'] })}
      />
    </main>
  );
}
