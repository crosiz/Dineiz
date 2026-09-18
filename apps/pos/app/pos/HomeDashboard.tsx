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
import { OrderTypeBadge } from '@/components/OrderStatusBadge';
import { TicketCard, type TicketLine } from '@/components/orders/TicketCard';
import { formatElapsed, minutesSince } from '@/lib/time';
import { TABLE_TONE } from '@/lib/table-tone';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/db';
import { kickOutbox } from '@/lib/core/outbox';
import { useSyncSummary, refreshSyncSummary } from '@/hooks/useSyncSummary';
import { toast } from 'sonner';
import { OrderDetailsModal } from './OrderDetailsModal';
import { isViewMode } from '@/lib/view-mode';
import { API_URL } from '@/lib/api';
import { AlertCircle, Armchair, ArrowRight, Banknote, CheckCircle2, ChevronRight, Clock, CloudOff, Pause, ReceiptText, Search, ShoppingBag, Utensils, X, type LucideIcon } from 'lucide-react';

// How long a ticket can sit in PENDING/IN_KITCHEN before it's worth
// surfacing on Home — matches the "rush" framing already used for KDS
// (kds/page.tsx's default rushThreshold).
const AGING_TICKET_MINUTES = 20;

// An order's live lines, identical ones merged, for the compact ticket.
function viewLines(order: any): TicketLine[] {
  const merged = new Map<string, TicketLine>();
  for (const it of order?.items ?? []) {
    if (it?.voided) continue;
    const name = it?.itemName ?? it?.name ?? 'Item';
    const key = [name, it?.variationName ?? '', it?.note ?? ''].join('|');
    const qty = Number(it?.qty ?? it?.quantity ?? 1);
    const existing = merged.get(key);
    if (existing) existing.qty += qty;
    else merged.set(key, { qty, name, note: it?.note ?? null, modifiers: it?.variationName ?? null });
  }
  return Array.from(merged.values());
}

const ATTENTION_TONE = {
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  brand: 'bg-brand/10 text-brand',
} as const;

function AttentionRow({
  tone, Icon, title, subtitle, onClick, action,
}: {
  tone: keyof typeof ATTENTION_TONE;
  Icon: LucideIcon;
  title: string;
  subtitle: ReactNode;
  onClick?: () => void;
  action?: ReactNode;
}) {
  const body = (
    <>
      <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${ATTENTION_TONE[tone]}`}>
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink truncate">{title}</span>
        <span className="block text-[12.5px] text-ink-3 mt-0.5">{subtitle}</span>
      </span>
      {action ?? (onClick && <ChevronRight className="w-4 h-4 text-ink-4 shrink-0" />)}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-sunken transition-colors">
      {body}
    </button>
  ) : (
    <div className="px-4 py-3 flex items-center gap-3">{body}</div>
  );
}

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
          {/* Quick actions. Compact tiles: the four things a cashier starts
              from, without two thirds of the screen given to icons. */}
          <section>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                {
                  label: 'New order',
                  sublabel: 'Pick a table',
                  Icon: Utensils,
                  usePrimary: true,
                  onClick: () => guardOrderEntry(() => router.push('/pos/tables')),
                },
                {
                  label: 'Takeaway',
                  sublabel: 'Counter & pick-up',
                  Icon: ShoppingBag,
                  usePrimary: false,
                  onClick: () => guardOrderEntry(() => router.push('/pos/order?type=takeaway')),
                },
                {
                  label: 'Tickets',
                  sublabel: activeOrders.length > 0 ? `${activeOrders.length} live` : 'Nothing live',
                  Icon: ReceiptText,
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets'),
                },
                {
                  label: 'On hold',
                  sublabel: heldOrdersCount > 0 ? `${heldOrdersCount} waiting` : 'None held',
                  Icon: Pause,
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets?filter=held'),
                },
              ].map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={action.onClick}
                  className={`h-[104px] rounded-xl p-4 flex flex-col justify-between text-left transition-colors active:scale-[0.99] ${
                    action.usePrimary
                      ? 'bg-brand text-on-brand hover:bg-brand-strong'
                      : 'bg-surface border border-line hover:border-line-strong text-ink'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-lg grid place-items-center ${
                      action.usePrimary ? 'bg-white/15 text-on-brand' : 'bg-sunken text-ink-2'
                    }`}
                  >
                    <action.Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-semibold leading-tight ${action.usePrimary ? 'text-on-brand' : 'text-ink'}`}>
                      {action.label}
                    </span>
                    <span className={`block text-[12px] mt-0.5 truncate ${action.usePrimary ? 'text-white/85' : 'text-ink-3'}`}>
                      {action.sublabel}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Active orders: the same ticket as the Tickets screen, compact. */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[17px] font-semibold text-ink">
                Active orders
                {activeOrders.length > 0 && <span className="ml-2 text-[14px] font-medium text-ink-3 tabular-nums">{activeOrders.length}</span>}
              </h2>
              <button
                onClick={() => router.push('/pos/tickets')}
                className="text-[13px] font-semibold text-brand hover:text-brand-strong flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {(() => {
              const q = homeSearch.trim().toLowerCase();
              const filtered = q
                ? activeOrders.filter(
                    (o) =>
                      (o.orderNumber || '').toLowerCase().includes(q) ||
                      (o.tableLabel || '').toLowerCase().includes(q) ||
                      (o.type || '').toLowerCase().includes(q),
                  )
                : activeOrders;

              if (filtered.length === 0) {
                return (
                  <div className="h-[120px] rounded-xl border border-dashed border-line-strong grid place-items-center text-center px-6">
                    <p className="text-[13px] text-ink-3">
                      {q ? 'No active orders match that search.' : 'No active orders. New ones appear here as they are punched.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {filtered.map((order: any) => (
                    <TicketCard
                      key={order.id}
                      compact
                      orderNumber={String(order.tokenNumber || order.orderNumber)}
                      type={order.type}
                      tableLabel={order.tableLabel}
                      status={order.status}
                      createdAt={order.createdAt}
                      lines={viewLines(order)}
                      total={Math.round(order.netAmount ?? order.totalAmount ?? 0)}
                      onOpen={() => openOrderDetails(order)}
                    />
                  ))}
                </div>
              );
            })()}
          </section>

          {/* Needs attention: one list, one row per thing to act on. It was a
              stack of full-width amber/rose/sky banners, each repeating
              "Order #… has been waiting 267m" with a bare VIEW link. */}
          <section id="needs-attention-section">
            <h2 className="text-[17px] font-semibold text-ink mb-3">
              Needs attention
              {needsAttentionCount > 0 && <span className="ml-2 text-[14px] font-medium text-ink-3 tabular-nums">{needsAttentionCount}</span>}
            </h2>
            <div className="bg-surface border border-line rounded-xl divide-y divide-line overflow-hidden">
              {needsAttentionCount === 0 && (
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-ok/10 text-ok shrink-0">
                    <CheckCircle2 className="w-[18px] h-[18px]" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">All clear</p>
                    <p className="text-[12.5px] text-ink-3">Nothing is waiting on you.</p>
                  </div>
                </div>
              )}

              {unsyncedCount > 0 && (
                <AttentionRow
                  tone={stuckCount > 0 ? 'danger' : 'info'}
                  Icon={stuckCount > 0 ? AlertCircle : CloudOff}
                  title={stuckCount > 0
                    ? `${stuckCount} change${stuckCount > 1 ? 's' : ''} the server rejected`
                    : `${unsyncedCount} change${unsyncedCount > 1 ? 's' : ''} waiting to sync`}
                  subtitle={stuckCount > 0 ? 'A manager can review them in Settings → Sync & data' : 'They send automatically when the server is reachable'}
                  action={
                    <button
                      onClick={retrySync}
                      disabled={isRetryingSync}
                      className="h-8 px-3 rounded-lg border border-line text-[12.5px] font-semibold text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50"
                    >
                      {isRetryingSync ? 'Syncing…' : 'Sync now'}
                    </button>
                  }
                />
              )}

              {billRequestedTables.map((t: any) => (
                <AttentionRow
                  key={`bill-${t.id}`}
                  tone="brand"
                  Icon={Banknote}
                  title={`${t.label} wants the bill`}
                  subtitle="Collect payment at the table"
                  onClick={() => router.push('/pos/tables')}
                />
              ))}

              {agingTickets.slice(0, 5).map((order: any) => (
                <AttentionRow
                  key={`aging-${order.id}`}
                  tone={minutesSince(order.createdAt) >= 45 ? 'danger' : 'warn'}
                  Icon={Clock}
                  title={`#${order.tokenNumber || order.orderNumber} · ${formatElapsed(order.createdAt)} ${order.status === 'PENDING' ? 'unsent' : 'in the kitchen'}`}
                  subtitle={
                    <span className="inline-flex items-center gap-2">
                      <OrderTypeBadge type={order.type} tableLabel={order.tableLabel} size="sm" />
                      {order.status === 'PENDING' ? 'Not sent to the kitchen yet' : 'Check with the kitchen'}
                    </span>
                  }
                  onClick={() => openOrderDetails(order)}
                />
              ))}
              {agingTickets.length > 5 && (
                <button
                  onClick={() => router.push('/pos/tickets')}
                  className="w-full px-4 py-3 text-left text-[13px] font-semibold text-brand hover:bg-sunken"
                >
                  {agingTickets.length - 5} more waiting orders
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Right column: this shift, then the floor. */}
        <div className="lg:col-span-5 bg-canvas border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-4">
          {/* Shift and its numbers, as one card. */}
          <section className="bg-surface border border-line rounded-xl">
            <div className="p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-ink-3">Your shift</p>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <h3 className="text-[18px] font-semibold text-ink truncate">
                    {isMounted ? session?.cashierName || 'Operator' : 'Operator'}
                  </h3>
                  {activeShift && (
                    <span
                      className={`h-5 px-2 rounded-full inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${
                        shiftStatus === 'CONFIRMED' ? 'bg-ok/10 text-ok' : 'bg-sunken text-ink-2'
                      }`}
                      title={shiftStatus === 'CONFIRMED' ? 'Open on the server' : 'Open on this terminal; the server confirms when it syncs'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${shiftStatus === 'CONFIRMED' ? 'bg-ok' : 'bg-ink-4'}`} />
                      {shiftStatus === 'CONFIRMED' ? 'Open' : 'On this terminal'}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] font-medium text-ink-3">On shift</p>
                <p className="mt-1 text-[18px] font-semibold text-ink tabular-nums">{activeShift ? shiftElapsed : '—'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 border-t border-line divide-x divide-line">
              {[
                ['Orders paid', String(perf.ordersServed)],
                ['Sales', formatPKR(Math.round(perf.totalValue))],
                ['Avg. order', formatPKR(Math.round(perf.averagePerOrder))],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-3.5 min-w-0">
                  <dt className="text-[12px] text-ink-3 truncate">{label}</dt>
                  <dd className="mt-0.5 text-[16px] font-semibold text-ink tabular-nums truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Tables: every table as a small tile in its status colour, with
              the counts above. Tapping a table starts an order on it. */}
          <section className="bg-surface border border-line rounded-xl flex flex-col">
            <div className="px-5 pt-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">Tables</h3>
              <button onClick={() => router.push('/pos/tables')} className="text-[13px] font-semibold text-brand hover:text-brand-strong flex items-center gap-1">
                Floor plan <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {tables.length === 0 ? (
              <div className="px-5 py-10 flex flex-col items-center text-ink-3 gap-2">
                <Armchair className="w-6 h-6" />
                <span className="text-[13px]">No floor plan loaded</span>
              </div>
            ) : (
              <>
                <div className="px-5 pt-2 pb-3 flex flex-wrap gap-x-4 gap-y-1">
                  {(['FREE', 'OCCUPIED', 'BILL_REQUESTED', 'RESERVED', 'DIRTY'] as const).map((st) => {
                    const n = tables.filter((t: any) => t.status === st).length;
                    if (!n) return null;
                    return (
                      <span key={st} className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
                        <span className={`w-2 h-2 rounded-full ${TABLE_TONE[st].dot}`} />
                        <span className="tabular-nums font-semibold text-ink-2">{n}</span> {TABLE_TONE[st].label}
                      </span>
                    );
                  })}
                </div>
                <div className="px-5 pb-5 flex flex-col gap-4">
                  {Object.entries(
                    tables.reduce((acc: Record<number, any[]>, t: any) => {
                      const f = t.floorNumber || 1;
                      (acc[f] ||= []).push(t);
                      return acc;
                    }, {}),
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([floor, list], _i, all) => (
                      <div key={floor}>
                        {all.length > 1 && <p className="text-[12px] font-medium text-ink-3 mb-2">Floor {floor}</p>}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-2">
                          {(list as any[]).map((t) => {
                            const tone = TABLE_TONE[t.status as keyof typeof TABLE_TONE] ?? TABLE_TONE.FREE;
                            const order = t.activeOrderId ? ordersMap[t.activeOrderId] : null;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() =>
                                  guardOrderEntry(() =>
                                    router.push(`/pos/order?type=dine-in&tableId=${t.id}&tableLabel=${encodeURIComponent(t.label)}`),
                                  )
                                }
                                className={`h-[58px] rounded-lg border px-2 flex flex-col items-center justify-center transition-colors ${tone.tile}`}
                                title={`${t.label} · ${tone.label}`}
                              >
                                <span className="text-[13px] font-semibold leading-none">{t.label}</span>
                                <span className="mt-1 text-[11px] leading-none opacity-80 tabular-nums">
                                  {order?.createdAt ? formatElapsed(order.createdAt) : `${t.capacity ?? 4} seats`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
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
