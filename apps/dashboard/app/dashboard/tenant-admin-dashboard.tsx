"use client";
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Activity,
  AlertTriangle, CheckCircle, Package, MonitorPlay,
  UtensilsCrossed, ShoppingBag, Bike, Clock
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { useUser } from '@/contexts/user-context';
import { useTick } from '@/lib/hooks';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { apiGet } from '@/lib/api-client';
import { API_URL } from '@/lib/api';
import {
  KpiCardSkeleton, TableRowSkeleton, ChartSkeleton, Skeleton, InlineError,
} from '@/components/ui/skeleton';

const ORDER_TABLE_COLS = [
  { w: 'w-14' },
  { w: 'w-20', pill: true },
  { w: 'w-16' },
  { w: 'w-16', pill: true },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function TenantAdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role, name, branch, tenantId } = useUser();
  const { selectedBranchId } = useDashboardContext();
  const isBranchManager = role === 'BRANCH_MANAGER';

  // Force re-render every minute for live timers
  useTick(60_000);

  const branchId = selectedBranchId;
  const period = searchParams.get('period') || 'today';

  const fetchSummary = async () => {
    return apiGet<any>('/api/analytics/dashboard-summary', {
      ...(branchId ? { branchId } : {}),
      period
    });
  };

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboardSummary', branchId, period],
    queryFn: fetchSummary,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: trendData, isLoading: isTrendLoading, isError: isTrendError, refetch: refetchTrend } = useQuery({
    queryKey: ['revenue-trend', branchId, period],
    queryFn: () => apiGet<any>('/api/analytics/revenue-trend', {
      ...(branchId ? { branchId } : {}),
      period
    }),
    staleTime: 60000,
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
      console.log('Socket event received: dashboard:stats_updated');
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

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', e.target.value);
    router.push(`?${params.toString()}`);
  };

  const invHealth = summary?.inventoryHealth;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-10 p-4 lg:p-8 max-w-[1400px] mx-auto bg-[#FAFAFA] min-h-screen">
      
      {/* ── Header & Action Bar ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
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
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/analytics?period=today')} className="px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-sm hover:shadow text-xs font-semibold text-slate-700 flex items-center gap-2 transition-all">
            <Activity className="w-3.5 h-3.5 text-slate-400" /> Today's Report
          </button>
          <button onClick={() => router.push('/dashboard/inventory?filter=low-stock')} className="px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-sm hover:shadow text-xs font-semibold text-slate-700 flex items-center gap-2 transition-all">
            <Package className="w-3.5 h-3.5 text-slate-400" /> Stock
          </button>
          <button onClick={() => window.open(process.env.NEXT_PUBLIC_POS_URL || 'http://localhost:3001', '_blank')} className="px-4 py-2 bg-white rounded-full border border-slate-200/60 shadow-sm hover:shadow text-xs font-semibold text-slate-700 flex items-center gap-2 transition-all">
            <MonitorPlay className="w-3.5 h-3.5 text-slate-400" /> Open POS
          </button>
        </div>
      </div>

      {/* Carried Over Shifts Indicator */}
      {summary?.carriedOver && summary.carriedOver.count > 0 && (
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {summary.carriedOver.count} shift{summary.carriedOver.count !== 1 ? 's' : ''} from yesterday is still open — 
            <span className="font-semibold ml-1">{formatPKR(summary.carriedOver.pendingReconciliation ?? 0)}</span> pending reconciliation.
          </p>
        </div>
      )}

      {/* Today's Shifts Widget */}
      <section className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100"><Clock className="w-4 h-4 text-slate-600" /></div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Today's Shifts</h2>
          </div>
          <button onClick={() => router.push('/dashboard/shifts')} className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">View all →</button>
        </div>

        {!shiftStats ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
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
                <div key={s.id} onClick={() => router.push(`/dashboard/shifts/${s.id}`)} className="flex items-center justify-between py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.user?.name ?? 'Cashier'}</p>
                      <p className="text-xs text-slate-500">{dur} · {s.branchId?.slice(0,8)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatPKR(Math.round(stats.totalSales ?? 0))}</p>
                </div>
              );
            })}
            {(shiftStats.count ?? 0) > 4 && (
              <p className="text-[10px] text-slate-400 text-center pt-1">+{shiftStats.count - 4} more active shifts</p>
            )}
          </div>
        )}
      </section>


      <div className="grid grid-cols-12 gap-4">
        {/* Left & Center */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-12 gap-4">

          {/* ── KPI Cards ── */}
          <div className="col-span-12 lg:col-span-6 grid grid-cols-2 gap-4">
            {isLoading ? (
              <>
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
              </>
            ) : isError ? (
              <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <InlineError message="Could not load KPIs" onRetry={refetch} />
              </div>
            ) : (
              <>
                {/* Revenue */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col justify-between h-[140px] hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Revenue</span>
                  <div>
                    <h3 className="text-3xl font-medium tracking-tight text-slate-900 mb-2">{formatPKR((summary?.revenue?.today || 0))}</h3>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${(summary?.revenue?.yesterdayChange ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {(summary?.revenue?.yesterdayChange ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{Math.abs(summary?.revenue?.yesterdayChange || 0).toFixed(1)}% vs yesterday</span>
                    </div>
                  </div>
                </div>

                {/* Total Orders */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col justify-between h-[140px] hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Total Orders</span>
                  <div>
                    <h3 className="text-3xl font-medium tracking-tight text-slate-900 mb-2">{summary?.totalOrders?.today || 0}</h3>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${(summary?.totalOrders?.yesterdayChange ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {(summary?.totalOrders?.yesterdayChange ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{Math.abs(summary?.totalOrders?.yesterdayChange || 0).toFixed(1)}% vs yesterday</span>
                    </div>
                  </div>
                </div>

                {/* Avg Order Value */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col justify-between h-[140px] hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Avg Order Value</span>
                  <div>
                    <h3 className="text-3xl font-medium tracking-tight text-slate-900 mb-2">{formatPKR((summary?.avgOrderValue?.today || 0))}</h3>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${summary?.avgOrderValue?.trend === 'up' ? 'text-emerald-600' : summary?.avgOrderValue?.trend === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                      {summary?.avgOrderValue?.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : summary?.avgOrderValue?.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                      <span className="capitalize">{summary?.avgOrderValue?.trend || 'Stable'}</span>
                    </div>
                  </div>
                </div>

                {/* Active Orders */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col justify-between h-[140px] hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Active Orders</span>
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-medium tracking-tight text-slate-900 mb-2">{activeOrdersCount}</h3>
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
                      <span>Live processing</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Inventory Health ── */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col">
              <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Inventory Health</h2>
              {isLoading ? (
                <div className="flex-1 flex flex-col gap-3 justify-center px-4">
                  <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <Skeleton className="h-3 w-44 mx-auto" />
                </div>
              ) : isError ? (
                <div className="flex-1"><InlineError onRetry={refetch} /></div>
              ) : invHealth?.status === 'healthy' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-green-50/50 rounded-xl">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white mb-2"><CheckCircle className="w-5 h-5" /></div>
                  <h3 className="text-sm font-bold text-green-900">Inventory Healthy</h3>
                  <p className="text-[10px] text-green-700 max-w-[180px] mx-auto leading-tight">{invHealth.message}</p>
                </div>
              ) : invHealth?.status === 'warning' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-amber-50/50 rounded-xl">
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white mb-2"><AlertTriangle className="w-5 h-5" /></div>
                  <h3 className="text-sm font-bold text-amber-900">Warning</h3>
                  <p className="text-[10px] text-amber-700 max-w-[180px] mx-auto leading-tight">{invHealth.message}</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-slate-400 rounded-full flex items-center justify-center text-white mb-2"><AlertTriangle className="w-5 h-5" /></div>
                  <h3 className="text-sm font-bold text-slate-700">Critical</h3>
                  <p className="text-[10px] text-slate-500 max-w-[180px] mx-auto leading-tight">{invHealth?.message ?? 'Check inventory levels'}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Orders ── */}
          <div className="col-span-12 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 flex flex-col gap-0 mb-6 min-h-[350px]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white">
              <h2 className="text-[14px] font-bold text-slate-800">Recent Orders</h2>
              <button onClick={() => router.push('/dashboard/order-history')} className="text-[12px] font-semibold text-[#FF5722] hover:text-[#e64a19] transition-colors">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Order #', 'Type', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                    <tr><td colSpan={4} className="py-16 text-center text-slate-400 font-medium text-sm">No recent orders</td></tr>
                  ) : (
                    summary.recentOrders.map((order: any) => (
                      <tr 
                        key={order.id} 
                        className="h-[52px] hover:bg-orange-50/30 transition-colors cursor-pointer group"
                        onClick={() => router.push('/dashboard/order-history')}
                      >
                        <td className="px-5 whitespace-nowrap font-mono text-[#FF5722] text-sm font-medium group-hover:underline">#{order.orderNumber}</td>
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
          <div className="col-span-12 bg-white p-6 rounded-3xl min-h-[300px]">
            <h2 className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-6">Top Selling Items</h2>
            <div className="space-y-4">
              {isLoading ? (
                [0, 80, 160].map((delay) => (
                  <div key={delay} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
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
                <p className="text-sm text-slate-400">No items sold today</p>
              ) : (
                summary.topSellingItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-slate-200">0{item.rank}</span>
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

          {/* Revenue Trends Chart */}
          <div className="bg-white p-6 rounded-3xl flex flex-col h-[320px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Revenue Trends</h2>
              <select
                value={period}
                onChange={handlePeriodChange}
                className="text-[10px] font-medium border border-slate-200 rounded-lg bg-slate-50 p-1 outline-none"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
            
            {/* Custom Tooltip matching Forecast styling */}
            {(() => {
              const CustomBarTooltip = ({ active, payload, label }: any) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 text-sm min-w-[200px]">
                      <p className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">{label}</p>
                      <p className="text-primary font-bold flex justify-between items-center gap-4 text-base">
                        <span className="text-slate-500 font-medium text-sm">Revenue</span> 
                        <span>{formatPKR(payload[0].value)}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              };

              return isTrendLoading ? (
                <ChartSkeleton height={220} />
              ) : isTrendError ? (
                <div className="flex-1"><InlineError onRetry={refetchTrend} /></div>
              ) : (
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData || []}>
                      <CartesianGrid strokeDasharray="0" vertical={false} horizontal={false} stroke="none" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatAxisPKR} />
                      <RTooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>

          {/* Branch Performance */}
          {!isBranchManager && (
            <div className="bg-white p-6 rounded-3xl flex-1">
              <h2 className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-6">Branch Performance</h2>
              <div className="space-y-3">
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
                  <p className="text-sm text-slate-400">No branches found</p>
                ) : (
                  summary.branchPerformance.map((branch: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
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
