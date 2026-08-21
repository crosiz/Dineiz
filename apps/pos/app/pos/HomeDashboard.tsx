'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCartStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useTopBar } from '@/hooks/useTopBar';
import { getPosSession, getPosShift, getToken } from '@/lib/pos-session';
import { useSocket } from '@/contexts/SocketContext';
import { formatPKR } from '@/lib/utils';
import { useSWROrders } from '@/hooks/useSWROrders';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/db';
import { syncOfflineOrders } from '@/lib/sync';
import { toast } from 'sonner';
import { OrderDetailsModal } from './OrderDetailsModal';

// How long a ticket can sit in PENDING/IN_KITCHEN before it's worth
// surfacing on Home — matches the "rush" framing already used for KDS
// (kds/page.tsx's default rushThreshold).
const AGING_TICKET_MINUTES = 20;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function HomeDashboard() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const cart = useCartStore((s) => s.cart);
  const [isMounted, setIsMounted] = useState(false);
  const { posSocket } = useSocket();

  // Search input on home screen
  const [homeSearch, setHomeSearch] = useState('');

  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
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

  // Local state for dashboard stats & orders
  const [stats, setStats] = useState({
    ordersServed: 0,
    totalValue: 0,
    averagePerOrder: 0,
  });
  // Instant paint from the IndexedDB (Dexie) cache, refreshed from the network
  // in the background — same stale-while-revalidate hook TicketsDashboard uses,
  // instead of an uncached fetch on every mount.
  const { orders: activeOrders } = useSWROrders({
    branchId: session?.branchId ?? null,
    dataMode: 'live',
    myOrdersOnly: false,
    sortOrder: 'newest',
    historySearch: '',
  });
  const [tables, setTables] = useState<any[]>([]);

  // Shift & Cashier info
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftStatus, setShiftStatus] = useState<string>('LOCAL');
  const [shiftElapsed, setShiftElapsed] = useState<string>('0h 0m');

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

  // Calculate Held Orders count
  const heldOrdersCount = activeOrders.filter((o) => o.status === 'HELD' || o.status === 'PARKED').length;

  // Stats Logic
  const fetchStats = useCallback(() => {
    if (!session?.branchId) return;
    
    const shiftStr = localStorage.getItem('pos_shift');
    const shift = shiftStr ? JSON.parse(shiftStr) : null;
    const shiftId = shift?.shiftId || shift?.id;

    if (!shiftId) {
      setStats({ ordersServed: 0, totalValue: 0, averagePerOrder: 0 });
      return;
    }

    fetch(`${API_URL}/api/analytics/today?branchId=${session.branchId}&shiftId=${shiftId}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setStats({
            ordersServed: data.orders || 0,
            totalValue: data.revenue || 0,
            averagePerOrder: data.orders ? data.revenue / data.orders : 0,
          });
        }
      })
      .catch(() => {});
  }, [session?.branchId]);

  useEffect(() => {
    fetchStats();
    
    if (posSocket) {
      posSocket.on('payment:confirmed', fetchStats);
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (posSocket) {
        posSocket.off('payment:confirmed', fetchStats);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStats, posSocket]);

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
    () => tables.filter((t: any) => t.statusInfo?.status === 'BILL_REQUESTED'),
    [tables]
  );
  const unsyncedOrders = useLiveQuery(() => {
    const db = getDB();
    return db.offlineOrders ? db.offlineOrders.where('syncStatus').anyOf(['pending', 'failed']).toArray() : [];
  }, []) ?? [];

  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const retrySync = async () => {
    setIsRetryingSync(true);
    try {
      await syncOfflineOrders();
      toast.success('Sync attempted for pending offline orders');
    } finally {
      setIsRetryingSync(false);
    }
  };

  const needsAttentionCount = agingTickets.length + billRequestedTables.length + unsyncedOrders.length;

  // Tables Logic
  const fetchTables = useCallback(() => {
    if (!session?.branchId) return;
    Promise.all([
      fetch(`${API_URL}/api/floor-plan/${session.branchId}/tables`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API_URL}/api/floor-plan/${session.branchId}/table-orders`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([tablesData, statusesData]) => {
        if (Array.isArray(tablesData)) {
          const statusMap = new Map();
          if (Array.isArray(statusesData)) {
            statusesData.forEach((s: any) => statusMap.set(s.tableId, s));
          }
          const mergedTables = tablesData.map((t: any) => ({
            ...t,
            statusInfo: statusMap.get(t.id) || null,
          }));
          setTables(mergedTables);
        }
      })
      .catch(() => {});
  }, [session?.branchId]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTables();
      }
    }, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTables();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTables]);

  return (
    <div className="flex flex-col h-[calc(100vh-72px-64px)] w-full bg-[#F8FAFC] overflow-hidden">
      {/* Search Header Strip */}
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-4 shrink-0 shadow-xs flex items-center justify-between">
        <div className="relative w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Search orders, tables, or tickets..."
            value={homeSearch}
            onChange={(e) => setHomeSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] placeholder-[#94A3B8] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D97706] focus:bg-white transition-all"
          />
          {homeSearch && (
            <button
              onClick={() => setHomeSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content Area */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Column (60%) */}
        <div className="col-span-7 p-8 overflow-y-auto no-scrollbar flex flex-col gap-8">
          {/* Hero Actions Grid (4 Cards 2x2 Layout) */}
          <section>
            <div className="grid grid-cols-2 gap-5">
              {[
                {
                  label: 'New Order',
                  sublabel: 'Table service & floor plan',
                  icon: 'restaurant',
                  usePrimary: true,
                  onClick: () => router.push('/pos/tables'),
                },
                {
                  label: 'Takeaway Order',
                  sublabel: 'Quick pick-up & counter order',
                  icon: 'shopping_bag',
                  usePrimary: false,
                  onClick: () => router.push('/pos/order?type=takeaway'),
                },
                {
                  label: 'Active Orders',
                  sublabel: 'View kitchen & live orders',
                  icon: 'receipt_long',
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets'),
                },
                {
                  label: 'Held Orders',
                  sublabel: heldOrdersCount > 0 ? `${heldOrdersCount} held order${heldOrdersCount > 1 ? 's' : ''}` : 'No held orders',
                  icon: 'pause',
                  usePrimary: false,
                  onClick: () => router.push('/pos/tickets?filter=held'),
                },
              ].map((action, idx) => (
                <div
                  key={idx}
                  onClick={action.onClick}
                  className={`hero-card h-[180px] rounded-2xl flex flex-col justify-between p-6 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] ${
                    action.usePrimary
                      ? 'bg-[#EA580C] text-white shadow-xl shadow-orange-500/30 border-none'
                      : 'bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-sm text-[#0F172A]'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      action.usePrimary
                        ? 'bg-white/20 border border-white/30 text-white'
                        : 'bg-amber-50 border border-amber-200 text-[#D97706]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">{action.icon}</span>
                  </div>
                  <div>
                    <div className={`clash-display text-2xl font-bold ${action.usePrimary ? 'text-white' : 'text-[#0F172A]'}`}>
                      {action.label}
                    </div>
                    <div className={`text-sm font-semibold ${action.usePrimary ? 'text-white/95' : 'text-[#64748B]'}`}>
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
              <h3 className="clash-display text-2xl text-[#0F172A]">Active Orders</h3>
              <button
                onClick={() => router.push('/pos/tickets')}
                className="text-[#D97706] font-bold text-sm flex items-center gap-1 hover:underline"
              >
                View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {activeOrders.length === 0 && homeSearch === '' ? (
                <div className="text-[#64748B] italic p-4">No active orders</div>
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
                    return <div className="text-[#64748B] italic p-4">No orders match your search</div>;
                  }

                  return filtered.map((order: any) => {
                    const itemCount = Array.isArray(order.items)
                      ? order.items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0)
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
                        onClick={() => setDetailsOrderId(order.id)}
                        style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
                        className="active-order-chip shrink-0 w-[210px] p-4 bg-white rounded-2xl cursor-pointer shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all border border-[#E2E8F0] flex flex-col gap-2.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[#0F172A] font-bold clash-display text-lg leading-none">#{order.tokenNumber || order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded uppercase tracking-wider">{typeLabel}</span>
                          {order.tableLabel && (
                            <span className="text-[10px] font-bold text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded">T-{order.tableLabel}</span>
                          )}
                        </div>
                        <div className="text-xs text-[#64748B] font-medium truncate">{itemCount} item{itemCount === 1 ? '' : 's'}</div>
                        <div className="flex justify-between items-end pt-1 mt-auto border-t border-[#F1F5F9]">
                          <span className="text-[#0F172A] font-bold clash-display">{formatPKR(Math.round(amount))}</span>
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
            <h3 className="clash-display text-2xl mb-1 text-[#0F172A]">Needs Attention</h3>
            {needsAttentionCount === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700">
                <span className="material-symbols-outlined">check_circle</span>
                <p className="font-bold">All clear — nothing waiting on you.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {agingTickets.map((order: any) => {
                  const minutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                  return (
                    <div
                      key={`aging-${order.id}`}
                      onClick={() => setDetailsOrderId(order.id)}
                      className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-amber-600">schedule</span>
                        <div>
                          <p className="font-bold text-[#0F172A]">Order #{order.tokenNumber || order.orderNumber} has been waiting {minutes}m</p>
                          <p className="text-xs text-[#64748B]">{order.tableLabel ? `Table ${order.tableLabel}` : order.type} · still {order.status === 'PENDING' ? 'not sent to kitchen' : 'in the kitchen'}</p>
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
                      <span className="material-symbols-outlined text-rose-600">payments</span>
                      <div>
                        <p className="font-bold text-[#0F172A]">Table {t.label} is waiting for the bill</p>
                        <p className="text-xs text-[#64748B]">Customer requested payment</p>
                      </div>
                    </div>
                    <span className="text-rose-700 font-bold text-xs uppercase tracking-widest px-2">Go to Table</span>
                  </div>
                ))}

                {unsyncedOrders.length > 0 && (
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-sky-600">cloud_off</span>
                      <div>
                        <p className="font-bold text-[#0F172A]">{unsyncedOrders.length} order{unsyncedOrders.length > 1 ? 's' : ''} saved offline, not yet synced</p>
                        <p className="text-xs text-[#64748B]">Will sync automatically when back online</p>
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
        <div className="col-span-5 bg-[#F8FAFC] border-l border-[#E2E8F0] p-6 overflow-y-auto no-scrollbar flex flex-col gap-8">
          {/* Shift Info Card */}
          <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-[#64748B] text-xs font-bold uppercase tracking-wider mb-1">Your Shift</h4>
                <div className="flex items-center gap-2">
                  <span className="clash-display text-2xl font-bold text-[#0F172A]">
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
            <div className="flex items-center gap-2 text-[#D97706]">
              <span className="material-symbols-outlined">schedule</span>
              <span className="clash-display text-xl font-bold tracking-wide">Elapsed: {shiftElapsed}</span>
            </div>
          </section>

          {/* Today at a Glance */}
          <section>
            <h4 className="clash-display text-2xl mb-4 text-[#0F172A]">Today's Performance</h4>
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-[#E2E8F0] p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-[#64748B] font-semibold">Orders served</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-[36px] font-bold text-[#0F172A] leading-none">{Math.round(stats.ordersServed)}</span>
                  <span className="text-xs text-[#94A3B8] font-medium mt-1">{activeShift ? 'This shift' : 'No shift open'}</span>
                </div>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-[#64748B] font-semibold">Total value</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-2xl font-bold text-[#0F172A]">{formatPKR(Math.round(stats.totalValue))}</span>
                  <span className="text-xs text-[#94A3B8] font-medium mt-1">{activeShift ? 'This shift' : 'No shift open'}</span>
                </div>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-4 flex justify-between items-center rounded-xl shadow-sm">
                <span className="text-[#64748B] font-semibold">Average per order</span>
                <div className="flex flex-col items-end">
                  <span className="clash-display text-2xl font-bold text-[#0F172A]">{formatPKR(Math.round(stats.averagePerOrder))}</span>
                  <span className="text-xs text-[#94A3B8] font-medium mt-1">{activeShift ? 'Per order this shift' : 'No shift open'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Table Status Mini Map (Original UI) */}
          <section className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h4 className="clash-display text-2xl text-[#0F172A]">Table Overview</h4>
              <button onClick={() => router.push('/pos/tables')} className="text-[#D97706] text-sm font-bold border-b border-[#D97706] hover:text-[#B45309]">
                View Full Floor
              </button>
            </div>
            <div className="flex-1 bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col relative overflow-hidden shadow-sm">
              {(() => {
                const tablesByFloor = tables.reduce((acc, t) => {
                  const f = t.floorNumber || t.floor || 1;
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
                      <div className="w-full flex flex-col items-center justify-center text-[#64748B] gap-2 my-auto">
                        <span className="material-symbols-outlined text-3xl">table_restaurant</span>
                        <span className="text-sm font-medium">No floor plan data loaded</span>
                      </div>
                    ) : (
                      floorNumbers.map((fNum) => (
                        <div key={fNum} className="min-w-full flex-shrink-0 snap-center flex flex-col items-center justify-start w-full pt-1">
                          {floorNumbers.length > 1 && (
                            <h5 className="text-[#64748B] text-xs font-bold uppercase tracking-wider mb-2 text-center w-full shrink-0">
                              Floor {fNum}
                            </h5>
                          )}
                          <div className="grid grid-cols-7 gap-x-2 gap-y-4 justify-items-center w-full px-2 pt-1 pb-6">
                            {tablesByFloor[fNum].map((t: any) => (
                              <div
                                key={t.id}
                                onClick={() =>
                                  router.push(`/pos/order?type=dine-in&tableId=${t.id}&tableLabel=${encodeURIComponent(t.label)}`)
                                }
                                className="flex flex-col items-center gap-1.5 cursor-pointer transition-transform hover:scale-110"
                              >
                                <div
                                  className={`size-8 rounded-full ${
                                    t.statusInfo || t.status === 'OCCUPIED' ? 'bg-amber-500 ring-amber-200' : 'bg-emerald-500 ring-emerald-200'
                                  } ring-4 shadow-sm`}
                                />
                                <span className="text-xs text-[#0F172A] font-bold text-center">{t.label}</span>
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
        onClose={() => setDetailsOrderId(null)}
        useKDS={useKDS}
      />
    </div>
  );
}
