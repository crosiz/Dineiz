"use client";
import { formatPKR } from '@/lib/formatters';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Minus, Activity,
  AlertTriangle, Package, MonitorPlay,
  UtensilsCrossed, ShoppingBag, Bike, Wallet, Receipt, Coins,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useUser } from '@/contexts/user-context';
import { useTick } from '@/lib/hooks';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { apiGet } from '@/lib/api-client';
import { API_URL } from '@/lib/api';
import {
  KpiCardSkeleton, TableRowSkeleton, ChartSkeleton, Skeleton, InlineError,
} from '@/components/ui/skeleton';

// recharts is ~90KB — keep it out of the home route's first-load bundle and
// pull it in only when the Revenue Trends card mounts.
const RevenueTrendChart = dynamic(() => import('./_components/RevenueTrendChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

const ORDER_TABLE_COLS = [
  { w: 'w-14' },
  { w: 'w-20', pill: true },
  { w: 'w-16' },
  { w: 'w-16', pill: true },
];

// Shared visual language for every card on this page.
const CARD = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wider text-slate-500';

// ─── Main Component ───────────────────────────────────────────────────────────
export function TenantAdminDashboard() {
  const router = useRouter();
  const { role, name, branch, tenantId } = useUser();
  const { selectedBranchId } = useDashboardContext();
  const isBranchManager = role === 'BRANCH_MANAGER';

  // Force re-render every minute for live timers
  useTick(60_000);

  const branchId = selectedBranchId;

  // The KPI strip, shifts, recent orders and top items are always "today" —
  // the Revenue Trends range selector below scopes only that one chart, via
  // its own query key, so switching it never reloads the rest of the page.
  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboardSummary', branchId],
    queryFn: () => apiGet<any>('/api/analytics/dashboard-summary', {
      ...(branchId ? { branchId } : {}),
      period: 'today',
    }),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const [trendPeriod, setTrendPeriod] = useState<'today' | '7d' | '30d'>('today');

  const {
    data: trendData, isLoading: isTrendLoading, isFetching: isTrendFetching, isError: isTrendError, refetch: refetchTrend,
  } = useQuery({
    queryKey: ['revenue-trend', branchId, trendPeriod],
    queryFn: () => apiGet<any>('/api/analytics/revenue-trend', {
      ...(branchId ? { branchId } : {}),
      period: trendPeriod,
    }),
    staleTime: 60000,
    // Hold the previous bars on screen (dimmed) while a new range loads,
    // instead of flashing back to a skeleton every time.
    placeholderData: keepPreviousData,
  });

  // Live shift stats for Today's Shifts widget
  const { data: shiftStats } = useQuery({
    queryKey: ['dashboard-shift-stats', branchId],
    queryFn: () => apiGet<any>('/api/shifts/stats/active', branchId ? { branchId } : {}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    if (summary?.activeOrders?.count !== undefined) {
      setActiveOrdersCount(summary.activeOrders.count);
    }
  }, [summary?.activeOrders?.count]);

  // Socket.IO live active orders and dashboard metrics refresh
  useEffect(() => {
    const socket = io(`${API_URL}/kds`, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      if (branchId) socket.emit('join_branch', branchId);
      else if (role === 'TENANT_ADMIN' && tenantId) socket.emit('join_tenant', tenantId);
    });

    socket.on('kds:new_order', () => {
      setActiveOrdersCount(p => p + 1);
      refetch();
      refetchTrend();
    });
    socket.on('kds:order_updated', (order: any) => {
      if (order.status === 'DELIVERED' || order.status === 'CANCELLED')
        setActiveOrdersCount(p => Math.max(0, p - 1));
      refetch();
    });
    socket.on('kds:order_cancelled', () => {
      setActiveOrdersCount(p => Math.max(0, p - 1));
      refetch();
    });
    socket.on('dashboard:stats_updated', () => {
      refetch();
      refetchTrend();
    });
    return () => { socket.disconnect(); };
  }, [branchId, refetch, role, tenantId, refetchTrend]);

  const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-500',
    IN_KITCHEN: 'bg-blue-500',
    READY: 'bg-orange-500',
    DISPATCHED: 'bg-purple-500',
    DELIVERED: 'bg-emerald-500',
    CANCELLED: 'bg-slate-400',
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const label: Record<string, string> = {
      IN_KITCHEN: 'In Kitchen', DELIVERED: 'Completed', COMPLETED: 'Completed',
      DISPATCHED: 'Dispatched',
    };
    return (
      <div className="inline-flex items-center gap-2 h-6">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[status] || 'bg-slate-300'}`} />
        <span className="text-xs font-medium text-slate-600 capitalize whitespace-nowrap leading-none mt-0.5">
          {(label[status] ?? status).toLowerCase()}
        </span>
      </div>
    );
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const icon = type === 'DINE_IN' ? <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : type === 'TAKEAWAY' ? <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    return (
      <div className="inline-flex items-center gap-2 h-6">
        {icon}
        <span className="text-xs font-medium text-slate-600 capitalize whitespace-nowrap leading-none mt-0.5">
          {type.replace('_', ' ').toLowerCase()}
        </span>
      </div>
    );
  };

  // Flat (0%) is not growth — render it neutral instead of a green "up" arrow.
  const TrendIndicator = ({ changePct }: { changePct: number }) => {
    if (changePct === 0) {
      return (
        <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
          <Minus className="w-3.5 h-3.5" />
          <span>No change vs yesterday</span>
        </div>
      );
    }
    const isUp = changePct > 0;
    return (
      <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span>{Math.abs(changePct).toFixed(1)}% vs yesterday</span>
      </div>
    );
  };

  const handleTrendPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTrendPeriod(e.target.value as 'today' | '7d' | '30d');
  };

  const invHealth = summary?.inventoryHealth;
  const showInventoryAlert = invHealth && invHealth.status !== 'healthy';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header & Action Bar ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          {isBranchManager && (
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">
              {getGreeting()}, {name?.split(' ')[0] || 'User'}
            </h1>
          )}
          <p className="text-sm font-medium text-slate-500">
            {branch?.name || 'Your Branch'} Overview
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard/analytics?period=today')} className="px-4 h-9 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors">
            <Activity className="w-3.5 h-3.5 text-slate-400" /> Today's Report
          </button>
          <button onClick={() => router.push('/dashboard/inventory?filter=low-stock')} className="px-4 h-9 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors">
            <Package className="w-3.5 h-3.5 text-slate-400" /> Stock
          </button>
          <button onClick={() => window.open(process.env.NEXT_PUBLIC_POS_URL || 'http://localhost:3001', '_blank')} className="px-4 h-9 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity">
            <MonitorPlay className="w-3.5 h-3.5" /> Open POS
          </button>
        </div>
      </div>

      {/* ── Alerts (only shown when there's something to act on) ── */}
      {(summary?.carriedOver && summary.carriedOver.count > 0) || showInventoryAlert ? (
        <div className="space-y-3">
          {summary?.carriedOver && summary.carriedOver.count > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                {summary.carriedOver.count} shift{summary.carriedOver.count !== 1 ? 's' : ''} from yesterday is still open —
                <span className="font-semibold ml-1">{formatPKR(summary.carriedOver.pendingReconciliation ?? 0)}</span> pending reconciliation.
              </p>
            </div>
          )}

          {showInventoryAlert && (
            <div className={`rounded-2xl p-4 flex items-center gap-3 justify-between ${invHealth.status === 'critical' ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${invHealth.status === 'critical' ? 'text-rose-600' : 'text-amber-600'}`} />
                <p className={`text-sm font-medium ${invHealth.status === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>
                  <span className="font-semibold">Inventory {invHealth.status === 'critical' ? 'critical' : 'warning'}:</span> {invHealth.message}
                </p>
              </div>
              <button onClick={() => router.push('/dashboard/inventory?filter=low-stock')} className={`text-xs font-bold whitespace-nowrap shrink-0 ${invHealth.status === 'critical' ? 'text-rose-700 hover:text-rose-900' : 'text-amber-700 hover:text-amber-900'}`}>
                Review →
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : isError ? (
          <div className={`col-span-full ${CARD}`}>
            <InlineError message="Could not load KPIs" onRetry={refetch} />
          </div>
        ) : (
          <>
            {/* Revenue */}
            <div className={`${CARD} p-5 flex items-start justify-between`}>
              <div>
                <span className={SECTION_LABEL}>Revenue</span>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-2 mb-1.5 font-mono">{formatPKR((summary?.revenue?.today || 0))}</h3>
                <TrendIndicator changePct={summary?.revenue?.yesterdayChange ?? 0} />
              </div>
              <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center shrink-0 border border-slate-200">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            {/* Total Orders */}
            <div className={`${CARD} p-5 flex items-start justify-between`}>
              <div>
                <span className={SECTION_LABEL}>Total Orders</span>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-2 mb-1.5 font-mono">{summary?.totalOrders?.today || 0}</h3>
                <TrendIndicator changePct={summary?.totalOrders?.yesterdayChange ?? 0} />
              </div>
              <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center shrink-0 border border-slate-200">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            {/* Avg Order Value */}
            <div className={`${CARD} p-5 flex items-start justify-between`}>
              <div>
                <span className={SECTION_LABEL}>Avg Order Value</span>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-2 mb-1.5 font-mono">{formatPKR((summary?.avgOrderValue?.today || 0))}</h3>
                <div className={`flex items-center gap-1 text-xs font-medium ${summary?.avgOrderValue?.trend === 'up' ? 'text-emerald-600' : summary?.avgOrderValue?.trend === 'down' ? 'text-rose-500' : 'text-slate-400'}`}>
                  {summary?.avgOrderValue?.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : summary?.avgOrderValue?.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  <span className="capitalize">{summary?.avgOrderValue?.trend || 'Stable'}</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center shrink-0 border border-slate-200">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Active Orders */}
            <div className={`${CARD} p-5 flex items-start justify-between`}>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={SECTION_LABEL}>Active Orders</span>
                  {activeOrdersCount > 0 && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-2 mb-1.5 font-mono">{activeOrdersCount}</h3>
                <div className={`flex items-center gap-1 text-xs font-medium ${activeOrdersCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span>{activeOrdersCount > 0 ? 'Live processing' : 'No orders in progress'}</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center shrink-0 border border-slate-200">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left & Center */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">

          {/* ── Today's Shifts ── */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <span className={SECTION_LABEL}>Today's Shifts</span>
              <button onClick={() => router.push('/dashboard/shifts')} className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">View all →</button>
            </div>

            {!shiftStats ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
              </div>
            ) : (shiftStats.count ?? 0) === 0 ? (
              <div className="flex items-center gap-3 py-3 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span className="text-sm">No active shifts right now</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(shiftStats.shifts ?? []).slice(0, 4).map((s: any) => {
                  const stats = s.liveStats ?? {};
                  const ms = Date.now() - new Date(s.openedAt).getTime();
                  const h = Math.floor(ms / 3_600_000);
                  const m = Math.floor((ms % 3_600_000) / 60_000);
                  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
                  return (
                    <div key={s.id} onClick={() => router.push(`/dashboard/shifts/${s.id}`)} className="flex items-center justify-between py-2.5 px-3.5 bg-slate-50 border border-slate-200/60 rounded-lg hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{s.user?.name ?? 'Cashier'}</p>
                          <p className="text-[11px] text-slate-500">{dur} · {s.branchId?.slice(0, 8)}</p>
                        </div>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-900">{formatPKR(Math.round(stats.totalSales ?? 0))}</p>
                    </div>
                  );
                })}
                {(shiftStats.count ?? 0) > 4 && (
                  <p className="text-[10px] text-slate-400 text-center pt-1">+{shiftStats.count - 4} more active shifts</p>
                )}
              </div>
            )}
          </div>

          {/* ── Recent Orders ── */}
          <div className={`${CARD} overflow-hidden min-h-[350px]`}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <span className={SECTION_LABEL}>Recent Orders</span>
              <button onClick={() => router.push('/dashboard/order-history')} className="text-xs font-bold text-primary hover:opacity-80 transition-opacity">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Order #', 'Type', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    [0, 100, 200, 300, 400].map((delay) => (
                      <TableRowSkeleton key={delay} cols={ORDER_TABLE_COLS} delay={delay} />
                    ))
                  ) : isError ? (
                    <tr><td colSpan={4}><InlineError onRetry={refetch} /></td></tr>
                  ) : !summary?.recentOrders?.length ? (
                    <tr><td colSpan={4} className="py-16 text-center text-slate-400 font-medium text-sm">No orders yet today</td></tr>
                  ) : (
                    summary.recentOrders.map((order: any) => (
                      <tr
                        key={order.id}
                        className="h-[52px] hover:bg-slate-50/60 transition-colors cursor-pointer group"
                        onClick={() => router.push('/dashboard/order-history')}
                      >
                        <td className="px-5 whitespace-nowrap font-mono text-primary text-sm font-medium group-hover:underline">#{order.orderNumber}</td>
                        <td className="px-5 whitespace-nowrap"><TypeBadge type={order.type} /></td>
                        <td className="px-5 text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatPKR(order.total ?? 0)}</td>
                        <td className="px-5 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Top Selling Items ── */}
          <div className={`${CARD} p-5`}>
            <span className={SECTION_LABEL}>Top Selling Items</span>
            <div className="mt-4 space-y-1">
              {isLoading ? (
                [0, 80, 160].map((delay) => (
                  <div key={delay} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-6 rounded-full" style={{ animationDelay: `${delay}ms` }} />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-36" style={{ animationDelay: `${delay}ms` }} />
                        <Skeleton className="h-2.5 w-20" style={{ animationDelay: `${delay}ms` }} />
                      </div>
                    </div>
                    <Skeleton className="h-3.5 w-16" style={{ animationDelay: `${delay}ms` }} />
                  </div>
                ))
              ) : isError ? (
                <InlineError onRetry={refetch} />
              ) : !summary?.topSellingItems?.length ? (
                <p className="text-sm text-slate-400 py-2">No items sold today</p>
              ) : (
                summary.topSellingItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-slate-200 w-6 text-right">{item.rank}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-500">{item.qtySold} units sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-primary">{formatPKR(item.revenue)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Revenue Trends + Branch Performance ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

          {/* Revenue Trends Chart — the only element on this page that isn't
              fixed to "today", so its range selector lives here rather than
              as a page-level filter; it drives only this chart's own query
              key (see revenue-trend above), never the rest of the page. */}
          <div className={`${CARD} p-5 flex flex-col h-[320px]`}>
            <div className="flex justify-between items-center mb-4">
              <span className={SECTION_LABEL}>Revenue Trends</span>
              <select
                value={trendPeriod}
                onChange={handleTrendPeriodChange}
                className="text-[10px] font-medium border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 outline-none focus:border-primary/40"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            <RevenueTrendChart
              trendData={trendData}
              isTrendLoading={isTrendLoading}
              isTrendFetching={isTrendFetching}
              isTrendError={isTrendError}
              refetchTrend={refetchTrend}
              trendPeriod={trendPeriod}
            />
          </div>

          {/* Branch Performance */}
          {!isBranchManager && (
            <div className={`${CARD} p-5 flex-1`}>
              <span className={SECTION_LABEL}>Branch Performance</span>
              <div className="mt-4 space-y-1">
                {isLoading ? (
                  [0, 120].map((delay) => (
                    <div key={delay} className="flex items-center justify-between p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" style={{ animationDelay: `${delay}ms` }} />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-24" style={{ animationDelay: `${delay}ms` }} />
                          <Skeleton className="h-2.5 w-16" style={{ animationDelay: `${delay}ms` }} />
                        </div>
                      </div>
                      <Skeleton className="h-3.5 w-14" style={{ animationDelay: `${delay}ms` }} />
                    </div>
                  ))
                ) : isError ? (
                  <InlineError onRetry={refetch} />
                ) : !summary?.branchPerformance?.length ? (
                  <p className="text-sm text-slate-400 py-2">No branches found</p>
                ) : (
                  summary.branchPerformance.map((branch: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-medium shrink-0">
                          {branch.name.substring(0, 2).toUpperCase()}
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${branch.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 leading-tight">{branch.name}</p>
                          <p className="text-xs text-slate-500">{branch.ordersToday} Orders Today</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 whitespace-nowrap">{formatPKR(branch.revenueToday)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
