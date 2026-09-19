'use client';

import { useBrandingStore } from '@/lib/branding-store';
import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useTopBar } from '@/hooks/useTopBar';
import { getPosSession, getPosShift, getToken } from '@/lib/pos-session';
import { useSocket } from '@/contexts/SocketContext';
import { formatPKR } from '@/lib/utils';
import { useShiftStats } from '@/hooks/useShiftStats';
import { useViews } from '@/lib/core/views';
import { markServed } from '@/lib/core/commands';
import { isShiftPendingOpen, resolveShiftId } from '@/lib/offline-shift';
import { OrderTypeBadge } from '@/components/OrderStatusBadge';
import { TicketCard, type TicketLine } from '@/components/orders/TicketCard';
import { formatAgo, formatElapsed, minutesSince } from '@/lib/time';
import { TABLE_TONE } from '@/lib/table-tone';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/db';
import { useSyncSummary } from '@/hooks/useSyncSummary';
import { useShiftActions } from '@/lib/shift-actions';
import { toast } from 'sonner';
import { OrderDetailsModal } from './OrderDetailsModal';
import { isViewMode } from '@/lib/view-mode';
import { API_URL } from '@/lib/api';
import {
  AlertCircle, Armchair, ArrowRight, Banknote, BellRing, Clock, Coffee, LogOut, Pause, ShoppingBag, Utensils, Wallet,
  type LucideIcon,
} from 'lucide-react';

// Home is the cashier's starting point, not a report. Top to bottom it answers
// "how do I start an order", "what needs me right now", "what's in progress",
// then, on the right, "how is my shift going" and "which tables are busy".
//
// Type scale on this screen: 12 (meta), 14 (body, buttons), 16 (titles, row
// headlines), 20 (money). Every control is at least 44px tall.

// How long a ticket can sit in PENDING/IN_KITCHEN before it's worth
// surfacing on Home — matches the "rush" framing already used for KDS
// (kds/page.tsx's default rushThreshold).
const AGING_TICKET_MINUTES = 20;

const ACTIVE_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'];

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

const TONE = {
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/10 text-danger',
  ok: 'bg-ok/10 text-ok',
  brand: 'bg-brand/10 text-brand',
} as const;

function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 min-h-11">
      <h2 className="text-[16px] font-semibold text-ink">
        {children}
        {!!count && <span className="ml-2 text-[14px] font-medium text-ink-3 tabular-nums">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 -mr-3 px-3 rounded-lg inline-flex items-center gap-1 text-[14px] font-semibold text-brand hover:bg-brand/5 hover:text-brand-strong"
    >
      {children} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

/** One thing that needs the person at the till, with the one button that deals with it. */
function TaskRow({
  tone, Icon, title, detail, action, onOpen,
}: {
  tone: keyof typeof TONE;
  Icon: LucideIcon;
  title: ReactNode;
  detail: ReactNode;
  action: { label: string; onClick: () => void; primary?: boolean };
  onOpen?: () => void;
}) {
  return (
    // Phones put the button on its own line: beside the text it squeezed the
    // title to "#I-1909-0…" and wrapped "ready 1m ago" over three lines.
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 min-h-[68px]">
      <button
        type="button"
        onClick={onOpen ?? action.onClick}
        className="min-w-0 flex-1 flex items-center gap-3 text-left"
      >
        <span className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${TONE[tone]}`}>
          <Icon className="w-5 h-5" strokeWidth={2.25} />
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold text-ink truncate">{title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3 min-w-0 whitespace-nowrap overflow-hidden">{detail}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={action.onClick}
        className={`h-11 px-4 w-full sm:w-auto rounded-lg text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
          action.primary
            ? 'bg-brand text-on-brand hover:bg-brand-strong'
            : 'bg-surface border border-line-strong text-ink hover:bg-sunken'
        }`}
      >
        {action.label}
      </button>
    </div>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const [isMounted, setIsMounted] = useState(false);
  const { posSocket } = useSocket();
  const askShift = useShiftActions((s) => s.ask);

  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  // The full order object from the list already on screen — passed to
  // OrderDetailsModal as initialOrder so it paints instantly instead of
  // blocking on a fresh GET /api/orders/:id every time a card is tapped.
  const [detailsOrder, setDetailsOrderState] = useState<any>(null);
  const openOrderDetails = (order: any) => {
    setDetailsOrderId(order.id);
    setDetailsOrderState(order);
  };
  // Same master-switch semantics as TicketsDashboard: the tenant-wide toggle
  // must be able to turn KDS off everywhere on its own.
  const useKDS = useBrandingStore(s => !!s.branding.kitchen?.useKDS && s.branding.branchKdsEnabled !== false);

  // Read from the shared event-derived store (lib/core/views.ts) — no fetch,
  // no loading state. Select the RAW maps and derive with useMemo: a selector
  // that builds a new array re-renders on every store notification.
  const ordersMap = useViews((s) => s.orders);
  const tablesMap = useViews((s) => s.tables);

  const activeOrders = useMemo(
    () =>
      Object.values(ordersMap)
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [ordersMap],
  );
  const tables = useMemo(() => Object.values(tablesMap), [tablesMap]);

  // Shift & cashier info
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftStatus, setShiftStatus] = useState<'CONFIRMED' | 'LOCAL'>('LOCAL');
  const [shiftElapsed, setShiftElapsed] = useState<string>('0h 0m');

  // Server-side shift totals — the ceiling once sync catches up (it also
  // folds in other terminals).
  const { stats, invalidate: invalidateStats } = useShiftStats(
    session?.branchId ?? null,
    activeShift?.shiftId || activeShift?.id || null
  );

  // Local-first: this shift's completed orders on this terminal. Ticks up the
  // instant a payment is collected, before the outbox has shipped it.
  const activeShiftId = activeShift?.shiftId || activeShift?.id || null;
  const localPerf = useMemo(() => {
    if (!activeShiftId) return { count: 0, value: 0 };
    const done = Object.values(ordersMap).filter(
      (o) => o.status === 'COMPLETED' && resolveShiftId(o.shiftId) === resolveShiftId(activeShiftId),
    );
    const value = done.reduce((sum, o) => sum + Number(o.netAmount ?? o.subtotal ?? 0), 0);
    return { count: done.length, value };
  }, [ordersMap, activeShiftId]);

  // Count and value from the SAME side, so the two always describe the same set.
  const perf = useMemo(() => {
    const serverServed = Math.round(stats.ordersServed || 0);
    const serverValue = Number(stats.totalValue || 0);
    const useServer = serverValue > localPerf.value || serverServed > localPerf.count;
    return {
      ordersServed: useServer ? serverServed : localPerf.count,
      totalValue: useServer ? serverValue : localPerf.value,
    };
  }, [stats.ordersServed, stats.totalValue, localPerf.count, localPerf.value]);

  // Spec Part 11 — in View Mode (signed in, no shift) order-entry actions stop
  // and explain themselves with an "Open a shift" prompt.
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

  // Is the shift open on the server too?
  useEffect(() => {
    const s = getPosSession();
    if (!s?.branchId) return;
    fetch(`${API_URL}/api/shifts/current?branchId=${s.branchId}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setShiftStatus(data && !data.error && data.status === 'OPEN' ? 'CONFIRMED' : 'LOCAL'))
      .catch(() => setShiftStatus('LOCAL'));
  }, []);

  // The page is named by the bottom bar's highlighted tab and the title; the
  // old small-caps "DASHBOARD" line under it added nothing.
  useTopBar({ pageTitle: 'Home', showBackButton: false });

  // Held orders are local-only drafts (lib/db.ts heldOrders) until resumed.
  const heldOrders = useLiveQuery(
    () => getDB().heldOrders.toArray().then((rows: any[]) => rows.sort((a, b) => String(a.heldAt).localeCompare(String(b.heldAt)))),
    [],
  ) ?? [];

  // A payment changes the server's totals — refetch rather than wait for the poll.
  useEffect(() => {
    if (!posSocket) return;
    posSocket.on('payment:confirmed', invalidateStats);
    return () => { posSocket.off('payment:confirmed', invalidateStats); };
  }, [posSocket, invalidateStats]);

  // ── Needs you ─────────────────────────────────────────────────────────
  // Only things the person at the till can act on, each with its own button.
  // Waiting-to-sync is not here: that fixes itself, and the banner under the
  // top bar says so while there's no connection.
  const billTables = useMemo(() => tables.filter((t: any) => t.status === 'BILL_REQUESTED'), [tables]);
  const readyOrders = useMemo(() => activeOrders.filter((o) => o.status === 'READY'), [activeOrders]);
  const agingOrders = useMemo(
    () => activeOrders.filter((o) =>
      (o.status === 'PENDING' || o.status === 'IN_KITCHEN') && minutesSince(o.createdAt) >= AGING_TICKET_MINUTES),
    [activeOrders],
  );
  const syncSummary = useSyncSummary();
  const rejectedCount = (syncSummary?.poisoned ?? 0) + (syncSummary?.abandoned ?? 0);

  const checkout = (orderId: string) =>
    guardOrderEntry(() => router.push(`/pos/order?orderId=${encodeURIComponent(orderId)}&checkout=true`));
  const serve = async (order: any) => {
    try {
      await markServed(order.id);
      toast.success(`#${order.tokenNumber || order.orderNumber} served`);
    } catch {
      toast.error('Could not mark it served. Open the order and try again.');
    }
  };

  const tasks: ReactNode[] = [];
  for (const t of billTables as any[]) {
    const order = t.activeOrderId ? ordersMap[t.activeOrderId] : null;
    tasks.push(
      <TaskRow
        key={`bill-${t.id}`}
        tone="brand"
        Icon={Banknote}
        title={`${t.label} asked for the bill`}
        detail={order ? <>#{order.tokenNumber || order.orderNumber} · {formatPKR(Math.round(order.netAmount ?? 0))}</> : 'Collect payment at the table'}
        action={{ label: 'Collect payment', primary: true, onClick: () => (order ? checkout(order.id) : router.push('/pos/tables')) }}
        onOpen={order ? () => openOrderDetails(order) : undefined}
      />,
    );
  }
  for (const o of readyOrders as any[]) {
    const dineIn = !!o.tableLabel;
    tasks.push(
      <TaskRow
        key={`ready-${o.id}`}
        tone="ok"
        Icon={BellRing}
        title={dineIn ? `Food ready for ${o.tableLabel}` : `#${o.tokenNumber || o.orderNumber} is ready`}
        detail={<><OrderTypeBadge type={o.type} tableLabel={o.tableLabel} size="sm" /> ready {formatAgo(o.readyAt ?? o.updatedAt ?? o.createdAt)}</>}
        action={dineIn
          ? { label: 'Served', onClick: () => serve(o) }
          : { label: 'Collect payment', primary: true, onClick: () => checkout(o.id) }}
        onOpen={() => openOrderDetails(o)}
      />,
    );
  }
  for (const o of agingOrders.slice(0, 5) as any[]) {
    const unsent = o.status === 'PENDING';
    tasks.push(
      <TaskRow
        key={`aging-${o.id}`}
        tone={minutesSince(o.createdAt) >= 45 ? 'danger' : 'warn'}
        Icon={Clock}
        title={`#${o.tokenNumber || o.orderNumber} waiting ${formatElapsed(o.createdAt)}`}
        detail={<><OrderTypeBadge type={o.type} tableLabel={o.tableLabel} size="sm" /> {unsent ? 'Not sent to the kitchen yet' : 'Check with the kitchen'}</>}
        action={{ label: 'Open', onClick: () => openOrderDetails(o) }}
      />,
    );
  }
  if (rejectedCount > 0) {
    tasks.push(
      <TaskRow
        key="rejected"
        tone="danger"
        Icon={AlertCircle}
        title={`${rejectedCount} change${rejectedCount === 1 ? '' : 's'} need a manager`}
        detail="The server did not accept them. Nothing is lost."
        action={{ label: 'Review', onClick: () => router.push('/pos/settings?section=sync') }}
      />,
    );
  }
  const taskCount = billTables.length + readyOrders.length + agingOrders.length + (rejectedCount > 0 ? 1 : 0);

  const pendingOpen = isMounted && activeShift && isShiftPendingOpen(activeShift.shiftId);
  const shiftPill = !activeShift ? null
    : pendingOpen ? { label: 'Opened offline', tone: 'bg-sunken text-ink-2', dot: 'bg-ink-4' }
    : shiftStatus === 'CONFIRMED' ? { label: 'Open', tone: 'bg-ok/10 text-ok', dot: 'bg-ok' }
    : null;

  return (
    <div className="h-full w-full bg-canvas overflow-y-auto lg:overflow-hidden no-scrollbar">
      <main className="min-h-full lg:h-full grid grid-cols-1 lg:grid-cols-12">
        {/* ── Left: start, needs you, in progress, on hold ─────────────── */}
        <div className="lg:col-span-7 p-4 sm:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6">
          {/* The only two ways to start work. */}
          <section className="grid grid-cols-2 gap-3">
            {[
              { label: 'Dine-in', sub: 'Pick a table', Icon: Utensils, primary: true, go: () => router.push('/pos/tables') },
              { label: 'Takeaway', sub: 'At the counter', Icon: ShoppingBag, primary: false, go: () => router.push('/pos/order?type=takeaway') },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => guardOrderEntry(a.go)}
                className={`h-16 rounded-xl px-4 flex items-center gap-3 text-left transition-colors active:scale-[0.99] ${
                  a.primary ? 'bg-brand text-on-brand hover:bg-brand-strong' : 'bg-surface border border-line-strong text-ink hover:bg-sunken'
                }`}
              >
                <a.Icon className={`w-6 h-6 shrink-0 ${a.primary ? '' : 'text-ink-2'}`} strokeWidth={2} />
                <span className="min-w-0">
                  <span className="block text-[16px] font-semibold leading-tight">{a.label}</span>
                  <span className={`block text-[12px] mt-0.5 truncate ${a.primary ? 'text-white/85' : 'text-ink-3'}`}>{a.sub}</span>
                </span>
              </button>
            ))}
          </section>

          {taskCount > 0 && (
            <section>
              <SectionTitle count={taskCount}>Needs you</SectionTitle>
              <div className="bg-surface border border-line rounded-xl divide-y divide-line overflow-hidden">
                {tasks}
                {agingOrders.length > 5 && (
                  <button
                    type="button"
                    onClick={() => router.push('/pos/tickets')}
                    className="w-full h-11 px-4 text-left text-[14px] font-semibold text-brand hover:bg-sunken"
                  >
                    {agingOrders.length - 5} more waiting orders
                  </button>
                )}
              </div>
            </section>
          )}

          <section>
            <SectionTitle
              count={activeOrders.length}
              action={activeOrders.length > 0 ? <LinkButton onClick={() => router.push('/pos/tickets')}>All tickets</LinkButton> : undefined}
            >
              Orders in progress
            </SectionTitle>
            {activeOrders.length === 0 ? (
              <p className="px-4 py-5 rounded-xl bg-surface border border-line text-[14px] text-ink-3">
                No orders in progress. Start one with Dine-in or Takeaway above.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3">
                {activeOrders.map((order: any) => (
                  <TicketCard
                    key={order.id}
                    compact
                    fill
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
            )}
          </section>

          {heldOrders.length > 0 && (
            <section>
              <SectionTitle count={heldOrders.length}>On hold</SectionTitle>
              <div className="bg-surface border border-line rounded-xl divide-y divide-line overflow-hidden">
                {heldOrders.map((h: any) => {
                  const items = (h.cart ?? []).reduce((n: number, c: any) => n + (Number(c.quantity) || 0), 0);
                  const total = (h.cart ?? []).reduce((n: number, c: any) => n + (Number(c.subtotal) || 0), 0);
                  return (
                    <TaskRow
                      key={h.id}
                      tone="warn"
                      Icon={Pause}
                      title={h.tableLabel ? `${h.tableLabel}` : h.orderType === 'TAKEAWAY' ? 'Takeaway' : 'Order'}
                      detail={<>{items} item{items === 1 ? '' : 's'} · {formatPKR(Math.round(total))}{h.heldAt ? ` · held ${formatAgo(h.heldAt)}` : ''}</>}
                      action={{ label: 'Resume', onClick: () => guardOrderEntry(() => router.push(`/pos/order?heldOrderId=${encodeURIComponent(h.id)}`)) }}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── Right: my shift, then the floor ─────────────────────────── */}
        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6">
          <section className="bg-surface border border-line rounded-xl">
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] text-ink-3">Your shift</p>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <h3 className="text-[16px] font-semibold text-ink truncate">
                    {isMounted ? session?.cashierName || 'Operator' : 'Operator'}
                  </h3>
                  {shiftPill && (
                    <span className={`h-6 px-2 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium shrink-0 ${shiftPill.tone}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${shiftPill.dot}`} />
                      {shiftPill.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] text-ink-3">On shift</p>
                <p className="mt-1 text-[16px] font-semibold text-ink tabular-nums">{activeShift ? shiftElapsed : '—'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 border-t border-line divide-x divide-line">
              {[
                ['Orders paid', String(perf.ordersServed)],
                ['Sales', formatPKR(Math.round(perf.totalValue))],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-3 min-w-0">
                  <dt className="text-[12px] text-ink-3">{label}</dt>
                  <dd className="mt-0.5 text-[20px] font-semibold text-ink tabular-nums truncate">{value}</dd>
                </div>
              ))}
            </dl>
            {activeShift && (
              // Close shift gets its own full-width row: it is the one that
              // ends the day, and three across didn't fit their labels at
              // tablet width ("Close s…").
              <div className="p-3 border-t border-line grid grid-cols-2 gap-2">
                {([
                  { label: 'Cash in / out', Icon: Wallet, act: 'cash', wide: false },
                  { label: 'Take a break', Icon: Coffee, act: 'break', wide: false },
                  { label: 'Close shift', Icon: LogOut, act: 'close', wide: true },
                ] as const).map((b) => (
                  <button
                    key={b.act}
                    type="button"
                    onClick={() => askShift(b.act)}
                    className={`h-11 px-3 rounded-lg border border-line-strong bg-surface text-[14px] font-semibold text-ink hover:bg-sunken inline-flex items-center justify-center gap-2 min-w-0 ${b.wide ? 'col-span-2' : ''}`}
                  >
                    <b.Icon className="w-4 h-4 text-ink-3 shrink-0" />
                    <span className="truncate">{b.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-surface border border-line rounded-xl">
            <div className="px-4 pt-2 flex items-center justify-between min-h-11">
              <h3 className="text-[16px] font-semibold text-ink">Tables</h3>
              <LinkButton onClick={() => router.push('/pos/tables')}>Floor plan</LinkButton>
            </div>
            {tables.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center text-ink-3 gap-2">
                <Armchair className="w-6 h-6" />
                <span className="text-[14px]">No floor plan loaded</span>
              </div>
            ) : (
              <>
                <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1">
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
                <div className="px-4 pb-4 flex flex-col gap-4">
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
                        {all.length > 1 && <p className="text-[12px] text-ink-3 mb-2">Floor {floor}</p>}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
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
                                className={`h-14 rounded-lg border px-1.5 flex flex-col items-center justify-center transition-colors ${tone.tile}`}
                                title={`${t.label} · ${tone.label}`}
                              >
                                <span className="text-[14px] font-semibold leading-none">{t.label}</span>
                                {order?.createdAt && (
                                  <span className="mt-1 text-[12px] leading-none opacity-80 tabular-nums">{formatElapsed(order.createdAt)}</span>
                                )}
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
