'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useTopBar } from '@/hooks/useTopBar';
import { getPosSession, getPosShift, getToken } from '@/lib/pos-session';
import { useSocket } from '@/contexts/SocketContext';
import { formatPKR } from '@/lib/utils';
import { useShiftStats } from '@/hooks/useShiftStats';
import { useViews } from '@/lib/core/views';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/db';
import { kickOutbox } from '@/lib/core/outbox';
import { useSyncSummary, refreshSyncSummary } from '@/hooks/useSyncSummary';
import { toast } from 'sonner';
import { OrderDetailsModal } from './OrderDetailsModal';
import { isViewMode } from '@/lib/view-mode';
import { API_URL } from '@/lib/api';
import { AlertCircle, Armchair, ArrowRight, Banknote, CheckCircle2, Clock, CloudOff, Pause, ReceiptText, Search, ShoppingBag, Utensils, X } from 'lucide-react';

// How long a ticket can sit in PENDING/IN_KITCHEN before it's worth
// surfacing on Home — matches the "rush" framing already used for KDS
// (kds/page.tsx's default rushThreshold).
const AGING_TICKET_MINUTES = 20;

const ACTIVE_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'];


export default function HomeDashboard() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const cart = useCartStore((s) => s.cart);
  const [isMounted, setIsMounted] = useState(false);
  const { posSocket } = useSocket();

  // Search input on home screen
  const [homeSearch, setHomeSearch] = useState('');

  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  // The full order object from the list the cashier already has on screen —
  // passed to OrderDetailsModal as initialOrder so it paints instantly
  // instead of blocking on a fresh GET /api/orders/:id every time a card is
  // tapped.
  const [detailsOrder, setDetailsOrderState] = useState<any>(null);
  const openOrderDetails = (order: any) => {
    setDetailsOrderId(order.id);
    setDetailsOrderState(order);
  };
  // Same master-switch semantics as TicketsDashboard: the tenant-wide toggle
  // must be able to turn KDS off everywhere on its own.
  const [useKDS] = useState<boolean>(() => {
    try {
      const tenantWide = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}')?.kitchen?.useKDS ?? false;
      const branchLevel = JSON.parse(localStorage.getItem('pos_branding') || '{}')?.branchKdsEnabled ?? false;
      return tenantWide && branchLevel;
    } catch {}
    return false;
  });

  // Phase 2: reads directly from the shared event-derived store instead of
  // fetching — populated by lib/core/views.ts's refreshOrders (bootstrap +
  // socket-driven, see POSLayout.tsx) merged with anything this terminal
  // created locally this session. No loading state, no per-screen fetch.
  // Select the RAW map and derive with useMemo.
  //
  // These selectors used to build the array inside the selector itself —
  // `useViews(s => Object.values(s.orders).filter(...).sort(...))`. Zustand
  // compares with Object.is, so a fresh array every evaluation means this
  // component re-rendered on EVERY store notification and re-ran an O(n log n)
  // derivation each time. Notifications are not rare: every appended event,
  // every reflectOrderSyncState (several per shipped event), the 60s table
  // reconcile, and every socket-driven refreshOrders. The raw map's identity
  // only changes when the data actually changes, so useMemo now does the work
  // once per real change instead of once per notification.
  const ordersMap = useViews((s) => s.orders);
  const tablesMap = useViews((s) => s.tables);

  const activeOrders = useMemo(
    () =>
      Object.values(ordersMap)
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [ordersMap],
  );
  // Phase 2: table view is the same shared store ClientTableMap now reads
  // from too (see lib/core/views.ts's seedTablesFromServer, kept fresh by
  // POSLayout.tsx's table:status_changed listener) — a table freed on the
  // Tables screen shows up here with no fetch, not just on the next poll.
  const tables = useMemo(() => Object.values(tablesMap), [tablesMap]);

  // Shift & Cashier info
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftStatus, setShiftStatus] = useState<string>('LOCAL');
  const [shiftElapsed, setShiftElapsed] = useState<string>('0h 0m');

  // Server-side shift totals — instant paint from cache, refreshed in the
  // background + on payment:confirmed. The authoritative number once sync
  // catches up (it also folds in refunds / other terminals).
  const { stats, invalidate: invalidateStats } = useShiftStats(
    session?.branchId ?? null,
    activeShift?.shiftId || activeShift?.id || null
  );

  // Local-first "Today's Performance": derived straight from the event store
  // for this shift's completed orders. Ticks up the instant a payment is
  // collected on this terminal — before the outbox has shipped it — which is
  // what "the numbers aren't updating" was really about. The server figure
  // above is used as a ceiling so another terminal's activity still shows.
  const activeShiftId = activeShift?.shiftId || activeShift?.id || null;
  // A selector returning an object LITERAL is the worst case of all: a brand new
  // object every evaluation, so Object.is never matched and this re-rendered on
  // every single store notification, forever. Derived from the raw map instead.
  const localPerf = useMemo(() => {
    if (!activeShiftId) return { count: 0, value: 0 };
    const done = Object.values(ordersMap).filter(
      (o) => o.status === 'COMPLETED' && o.shiftId === activeShiftId,
    );
    const value = done.reduce((sum, o) => sum + Number(o.netAmount ?? o.subtotal ?? 0), 0);
    return { count: done.length, value };
  }, [ordersMap, activeShiftId]);

  // The local figure leads (it ticks up the instant a payment is collected on
  // this terminal, before the outbox has shipped it) and the server figure is a
  // ceiling so another terminal's activity still shows. Take the count and the
  // value from the SAME side, though — maxing each independently could pair
  // this terminal's order count with the branch's revenue and report an average
  // that matches neither.
  const perf = useMemo(() => {
    const serverServed = Math.round(stats.ordersServed || 0);
    const serverValue = Number(stats.totalValue || 0);
    const useServer = serverValue > localPerf.value || serverServed > localPerf.count;
    const ordersServed = useServer ? serverServed : localPerf.count;
    const totalValue = useServer ? serverValue : localPerf.value;
    return {
      ordersServed,
      totalValue,
      averagePerOrder: ordersServed ? totalValue / ordersServed : 0,
    };
  }, [stats.ordersServed, stats.totalValue, localPerf.count, localPerf.value]);

  // Spec Part 11 — in View Mode (signed in, no shift) order-entry CTAs stop
  // navigating and explain themselves with an inline "Open a shift" prompt.
  const viewMode = isMounted && isViewMode();
  const guardOrderEntry = (go: () => void) => {
    if (viewMode) {
      toast.message('Open a shift to take orders', {
        action: { label: 'Open Shift', onClick: () => router.push('/pos/shift/open') },
      });
      return;
    }
    go();
  };

  useEffect(() => {
    setIsMounted(true);
    const shift = getPosShift();
    setActiveShift(shift);

    // Compute shift elapsed time
    if (shift?.openedAt) {
      const updateShiftTime = () => {
        const ms = Date.now() - new Date(shift.openedAt).getTime();
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        setShiftElapsed(`${h}h ${m}m`);
      };
      updateShiftTime();
      const timer = setInterval(updateShiftTime, 60000);
      return () => clearInterval(timer);
    }
  }, []);

  // Verify shift with backend (online status check)
  useEffect(() => {
    const s = getPosSession();
    if (!s?.branchId) return;

    fetch(`${API_URL}/api/shifts/current?branchId=${s.branchId}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error && data.status === 'OPEN') {
          setShiftStatus('CONFIRMED');
        } else {
          setShiftStatus('LOCAL');
        }
      })
      .catch(() => setShiftStatus('LOCAL'));
  }, []);

  // Configure TopBar for Home
  useTopBar({
    pageTitle: 'Home',
    breadcrumb: 'Dashboard',
    showBackButton: false,
  });

  // Held orders are local-only drafts (see lib/db.ts's heldOrders table) —
  // they never become a real ORDER_CREATED event (or a server order at all)
  // until resumed, so they never appear in useViews.orders. The previous
  // `activeOrders.filter(o => o.status === 'HELD' || 'PARKED')` check was
  // always empty for the same reason even before this conversion — neither
  // status value is ever set on a live order.
  const heldOrdersCount = useLiveQuery(() => getDB().heldOrders.count(), []) ?? 0;

  // A payment changes today's revenue/order-count numbers server-side —
  // force the cached stats to refetch rather than waiting for the next
  // 60s poll.
  useEffect(() => {
    if (!posSocket) return;
    posSocket.on('payment:confirmed', invalidateStats);
    return () => { posSocket.off('payment:confirmed', invalidateStats); };
  }, [posSocket, invalidateStats]);

  // The table:status_changed → refresh wiring now lives centrally in
  // POSLayout.tsx (it refreshes lib/core/views.ts's shared table store,
  // which this screen and ClientTableMap both read), so no per-screen
  // listener is needed here anymore.

  // "Needs Attention" — replaces the old Alerts section, which called
  // GET /api/v1/tenant/alerts (only a GET is registered — the "Clear"
  // button's DELETE call 404'd) and rendered fields (alert.type/message/
  // detail/id) that don't exist on that endpoint's actual payload (raw
  // low-stock rows: itemName/quantity/reorderLevel) — so the section was
  // permanently empty, and tenant-wide ingredient stock is a manager
  // concern anyway, not something a cashier acts on mid-service.
  //
  // Everything here is derived from data the screen already loads — no
  // new endpoint — and is directly actionable by whoever's on shift.
  const isAging = (order: any) => {
    if (order.status !== 'PENDING' && order.status !== 'IN_KITCHEN') return false;
    const minutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    return minutes >= AGING_TICKET_MINUTES;
  };
  const agingTickets = useMemo(() => activeOrders.filter(isAging), [activeOrders]);
  const billRequestedTables = useMemo(
    () => tables.filter((t: any) => t.status === 'BILL_REQUESTED'),
    [tables]
  );
  // lib/sync.ts's queueOfflineOrder/queueOfflinePayment/queueItemAdd (and the
  // offlineOrders/offlinePayments/pendingItemAdds tables they wrote to) are
  // dead code — nothing has written to those tables since the outbox
  // (lib/core/outbox.ts) took over. This card used to read only those tables,
  // so it always reported 0 unsynced and "Retry Now" always "succeeded"
  // regardless of the real backlog. Poll the actual outbox summary instead —
  // the same source SyncHealthDot in the top bar already uses, so the two
  // indicators can't disagree.
  // The same shared subscription the top bar's indicator reads, rather than a
  // second identical 4s IndexedDB poll running alongside it.
  const syncSummary = useSyncSummary();
  const unsyncedCount = syncSummary?.count ?? 0;
  const stuckCount = (syncSummary?.poisoned ?? 0) + (syncSummary?.abandoned ?? 0);

  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const retrySync = async () => {
    setIsRetryingSync(true);
    kickOutbox('immediate');
    toast.success('Sync attempted for pending offline data');
    refreshSyncSummary();
    // Give the drain a moment to actually move something before the summary
    // re-polls on its own 4s cadence — otherwise the button's own state
    // clears before there's anything new to see.
    setTimeout(() => setIsRetryingSync(false), 1000);
  };

  const needsAttentionCount = agingTickets.length + billRequestedTables.length + unsyncedCount;

  // h-full, not a hardcoded calc(100vh - 72px - 64px): POSLayout's content
  // slot is already exactly "viewport minus top bar minus bottom nav" via
  // flex-1 in a flex column, so this only needs to fill that — a hardcoded
  // calc against the shells' own current pixel heights silently goes stale
  // the moment either one changes (as it did the moment BottomNav grew by a
  // device's safe-area inset).
  return (
    <div className="flex flex-col h-full w-full bg-canvas overflow-hidden">
      {/* Search Header Strip */}
      <div className="bg-white border-b border-line px-8 py-4 shrink-0 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 w-[20px] h-[20px]" />
          <input
            type="text"
            placeholder="Search orders, tables, or tickets..."
            value={homeSearch}
            onChange={(e) => setHomeSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-sunken border border-line-strong text-ink placeholder-ink-4 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
          />
          {homeSearch && (
            <button
              onClick={() => setHomeSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
            >
              <X className="w-[14px] h-[14px]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content Area — single column, whole-page scroll below lg
          (each panel's own overflow-y-auto only makes sense once the grid
          row's shrunk it to a fixed cross-axis size the way lg:grid-cols-12
          does); side-by-side 7/5 split with two independently-scrolling
          panels from lg up, as before. */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden no-scrollbar">
        {/* Left Column (60%) */}
        <div className="lg:col-span-7 p-4 sm:p-8 lg:overflow-y-auto no-scrollbar flex flex-col gap-6 sm:gap-8">
          {/* Hero Actions Grid (4 Cards 2x2 Layout) */}
          <section>
            <div className="grid grid-cols-2 gap-5">
              {[
                {
                  label: 'New Order',
                  sublabel: 'Table service & floor plan',
                  Icon: Utensils,
                  usePrimary: true,
                  onClick: () => guardOrderEntry(() => router.push('/pos/tables')),
                },
                {
                  label: 'Takeaway Order',
                  sublabel: 'Quick pick-up & counter order',
                  Icon: ShoppingBag,
                  usePrimary: false,
                  onClick: () => guardOrderEntry(() => router.push('/pos/order?type=takeaway')),
                },
                {
                  label: 'Active Orders',
                  sublabel: 'View kitchen & live orders',
                  Icon: ReceiptText,
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets'),
                },
                {
                  label: 'Held Orders',
                  sublabel: heldOrdersCount > 0 ? `${heldOrdersCount} held order${heldOrdersCount > 1 ? 's' : ''}` : 'No held orders',
                  Icon: Pause,
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets?filter=held'),
                },
              ].map((action, idx) => (
                <div
                  key={idx}
                  onClick={action.onClick}
                  className={`hero-card h-[180px] rounded-2xl flex flex-col justify-between p-6 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] ${
                    action.usePrimary
                      ? 'bg-brand text-white shadow-xl shadow-orange-500/30 border-none'
                      : 'bg-white border border-line hover:border-line-strong shadow-sm text-ink'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      action.usePrimary
                        ? 'bg-white/20 border border-white/30 text-white'
                        : 'bg-amber-50 border border-amber-200 text-brand'
                    }`}
                  >
                    <action.Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <div className={`clash-display text-2xl font-bold ${action.usePrimary ? 'text-white' : 'text-ink'}`}>
                      {action.label}
                    </div>
                    <div className={`text-sm font-semibold ${action.usePrimary ? 'text-white/95' : 'text-ink-3'}`}>
                      {action.sublabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Active Orders Strip */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="clash-display text-2xl text-ink">Active Orders</h3>
              <button
                onClick={() => router.push('/pos/tickets')}
                className="text-brand font-bold text-sm flex items-center gap-1 hover:underline"
              >
                View All <ArrowRight className="w-[14px] h-[14px]" />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {activeOrders.length === 0 && homeSearch === '' ? (
                <div className="text-ink-3 italic p-4">No active orders</div>
              ) : (
                (() => {
                  const filtered = homeSearch
                    ? activeOrders.filter(
                        (o) =>
                          (o.orderNumber || '').toLowerCase().includes(homeSearch.toLowerCase()) ||
                          (o.tableLabel || '').toLowerCase().includes(homeSearch.toLowerCase()) ||
                          (o.type || '').toLowerCase().includes(homeSearch.toLowerCase())
                      )
                    : activeOrders;

                  if (filtered.length === 0 && homeSearch !== '') {
                    return <div className="text-ink-3 italic p-4">No orders match your search</div>;
                  }

                  return filtered.map((order: any) => {
                    const itemCount = Array.isArray(order.items)
                      ? order.items.reduce((acc: number, i: any) => acc + (i.qty ?? i.quantity ?? 1), 0)
                      : (order.itemCount || order.itemsCount || 1);
                    const amount = order.netAmount ?? order.totalAmount ?? order.total ?? order.subtotal ?? 0;
                    const typeLabel = order.type === 'DINE_IN' ? 'DINE-IN' : order.type === 'TAKEAWAY' ? 'TAKEAWAY' : 'DELIVERY';
                    // Same left-accent language Tickets already uses for
                    // service type (see TicketsDashboard's "Dine-In" /
                    // "Takeaway & Delivery" section dots) rather than
                    // inventing a new colour scheme just for this card.
                    const accentColor = order.type === 'DINE_IN' ? '#2A5DB0' : 'var(--pos-primary,#F59E0B)';

                    return (
                      <div
                        key={order.id}
                        onClick={() => openOrderDetails(order)}
                        style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
                        className="active-order-chip shrink-0 w-[210px] p-4 bg-white rounded-2xl cursor-pointer shadow-sm hover:shadow-md hover:border-line-strong transition-all border border-line flex flex-col gap-2.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-ink font-bold clash-display text-lg leading-none">#{order.tokenNumber || order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-ink-3 bg-sunken px-1.5 py-0.5 rounded uppercase tracking-wider">{typeLabel}</span>
                          {/* The label already IS the table's name ("T-4"), so
                              prefixing it printed "T-T-4". A branch is free to
                              call its tables anything — "Patio 2", "VIP" — and a
                              hardcoded prefix is wrong for all of them. */}
                          {order.tableLabel && (
                            <span className="text-[10px] font-bold text-ink-2 bg-canvas border border-line px-1.5 py-0.5 rounded">{order.tableLabel}</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-3 font-medium truncate">{itemCount} item{itemCount === 1 ? '' : 's'}</div>
                        <div className="flex justify-between items-end pt-1 mt-auto border-t border-line">
                          <span className="text-ink font-bold clash-display">{formatPKR(Math.round(amount))}</span>
                          {order.createdAt && <TicketTimer createdAt={order.createdAt} />}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </section>

          {/* Needs Attention — real, actionable signal derived from data this
              screen already loads, in place of the old "Alerts" section
              (which called a GET-only endpoint's DELETE, rendered fields
              that endpoint never returned, and showed manager-facing
              ingredient stock to a cashier — see HomeDashboard notes above). */}
          <section className="flex flex-col gap-2" id="needs-attention-section">
            <h3 className="clash-display text-2xl mb-1 text-ink">Needs Attention</h3>
            {needsAttentionCount === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700">
                <CheckCircle2 className="w-[20px] h-[20px]" />
                <p className="font-bold">All clear — nothing waiting on you.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {agingTickets.map((order: any) => {
                  const minutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                  return (
                    <div
                      key={`aging-${order.id}`}
                      onClick={() => openOrderDetails(order)}
                      className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Clock className="text-amber-600 w-[20px] h-[20px]" />
                        <div>
                          <p className="font-bold text-ink">Order #{order.tokenNumber || order.orderNumber} has been waiting {minutes}m</p>
                          <p className="text-xs text-ink-3">{order.tableLabel ? `Table ${order.tableLabel}` : order.type} · still {order.status === 'PENDING' ? 'not sent to kitchen' : 'in the kitchen'}</p>
                        </div>
                      </div>
                      <span className="text-amber-700 font-bold text-xs uppercase tracking-widest px-2">View</span>
                    </div>
                  );
                })}

                {billRequestedTables.map((t: any) => (
                  <div
                    key={`bill-${t.id}`}
                    onClick={() => router.push('/pos/tables')}
                    className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:border-rose-300 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Banknote className="text-rose-600 w-[20px] h-[20px]" />
                      <div>
                        <p className="font-bold text-ink">Table {t.label} is waiting for the bill</p>
                        <p className="text-xs text-ink-3">Customer requested payment</p>
                      </div>
                    </div>
                    <span className="text-rose-700 font-bold text-xs uppercase tracking-widest px-2">Go to Table</span>
                  </div>
                ))}

                {unsyncedCount > 0 && (
                  <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
                    stuckCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-sky-50 border-sky-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      {stuckCount > 0
                        ? <AlertCircle className="w-5 h-5 text-rose-600" />
                        : <CloudOff className="w-5 h-5 text-sky-600" />}
                      <div>
                        <p className="font-bold text-ink">
                          {stuckCount > 0
                            ? `${stuckCount} change${stuckCount > 1 ? 's' : ''} the server rejected — needs a manager`
                            : `${unsyncedCount} change${unsyncedCount > 1 ? 's' : ''} not yet synced`}
                        </p>
                        <p className="text-xs text-ink-3">
                          {stuckCount > 0 ? 'Review in Settings → Sync & Data' : 'Will sync automatically in the background'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={retrySync}
                      disabled={isRetryingSync}
                      className="bg-sky-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50"
                    >
                      {isRetryingSync ? 'Syncing…' : 'Retry Now'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column (40%) */}
        <div className="lg:col-span-5 bg-canvas border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6 sm:gap-8">
          {/* Shift Info Card */}
          <section className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-ink-3 text-xs font-bold uppercase tracking-wider mb-1">Your Shift</h4>
                <div className="flex items-center gap-2">
                  <span className="clash-display text-2xl font-bold text-ink">
                    {isMounted ? session?.cashierName || 'Operator' : 'Operator'}
                  </span>
                  {activeShift && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full flex items-center gap-1.5 ${
                        shiftStatus === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          shiftStatus === 'CONFIRMED' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      {shiftStatus === 'CONFIRMED' ? 'Active' : 'Local'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-brand">
              <Clock className="w-[20px] h-[20px]" />
              <span className="clash-display text-xl font-bold tracking-wide">Elapsed: {shiftElapsed}</span>
            </div>
          </section>

          {/* Today at a Glance */}
          <section>
            <h4 className="clash-display text-2xl mb-4 text-ink">Today's Performance</h4>
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-line p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-ink-3 font-semibold">Orders served</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-[36px] font-bold text-ink leading-none">{perf.ordersServed}</span>
                  <span className="text-xs text-ink-4 font-medium mt-1">{activeShift ? 'This shift' : 'No shift open'}</span>
                </div>
              </div>
              <div className="bg-white border border-line p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-ink-3 font-semibold">Total value</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-2xl font-bold text-ink">{formatPKR(Math.round(perf.totalValue))}</span>
                  <span className="text-xs text-ink-4 font-medium mt-1">{activeShift ? 'This shift' : 'No shift open'}</span>
                </div>
              </div>
              <div className="bg-white border border-line p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-ink-3 font-semibold">Average per order</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-2xl font-bold text-ink">{formatPKR(Math.round(perf.averagePerOrder))}</span>
                  <span className="text-xs text-ink-4 font-medium mt-1">{activeShift ? 'Per order this shift' : 'No shift open'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Table Status Mini Map (Original UI) */}
          <section className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h4 className="clash-display text-2xl text-ink">Table Overview</h4>
              <button onClick={() => router.push('/pos/tables')} className="text-brand text-sm font-bold border-b border-brand hover:text-brand-strong">
                View Full Floor
              </button>
            </div>
            <div className="flex-1 bg-white border border-line rounded-2xl p-4 flex flex-col relative overflow-hidden shadow-sm">
              {(() => {
                const tablesByFloor = tables.reduce((acc, t) => {
                  const f = t.floorNumber || 1;
                  if (!acc[f]) acc[f] = [];
                  acc[f].push(t);
                  return acc;
                }, {} as Record<number, any[]>);

                const floorNumbers = Object.keys(tablesByFloor)
                  .map(Number)
                  .sort((a, b) => a - b);

                return (
                  <div
                    id="home-table-carousel"
                    className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar w-full flex snap-x snap-mandatory"
                    style={{ scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                  >
                    {floorNumbers.length === 0 ? (
                      <div className="w-full flex flex-col items-center justify-center text-ink-3 gap-2 my-auto">
                        <Armchair className="w-[30px] h-[30px]" />
                        <span className="text-sm font-medium">No floor plan data loaded</span>
                      </div>
                    ) : (
                      floorNumbers.map((fNum) => (
                        <div key={fNum} className="min-w-full flex-shrink-0 snap-center flex flex-col items-center justify-start w-full pt-1">
                          {floorNumbers.length > 1 && (
                            <h5 className="text-ink-3 text-xs font-bold uppercase tracking-wider mb-2 text-center w-full shrink-0">
                              Floor {fNum}
                            </h5>
                          )}
                          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-x-1 gap-y-2 justify-items-center w-full px-2 pt-1 pb-6">
                            {tablesByFloor[fNum].map((t: any) => (
                              <div
                                key={t.id}
                                onClick={() =>
                                  guardOrderEntry(() =>
                                    router.push(`/pos/order?type=dine-in&tableId=${t.id}&tableLabel=${encodeURIComponent(t.label)}`)
                                  )
                                }
                                className="flex flex-col items-center gap-1.5 cursor-pointer transition-transform hover:scale-110 p-1.5"
                              >
                                <div
                                  className={`size-10 rounded-full ${
                                    t.status !== 'FREE' ? 'bg-amber-500 ring-amber-200' : 'bg-emerald-500 ring-emerald-200'
                                  } ring-4 shadow-sm`}
                                />
                                <span className="text-xs text-ink font-bold text-center">{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
          </section>
        </div>
      </main>

      <OrderDetailsModal
        orderId={detailsOrderId}
        initialOrder={detailsOrder}
        onClose={() => { setDetailsOrderId(null); setDetailsOrderState(null); }}
        useKDS={useKDS}
      />
    </div>
  );
}
