"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { apiGet } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronDown, Activity, AlertTriangle
} from "lucide-react";
import { useTick } from "@/lib/hooks";
import { formatPKR, formatVariance } from "@/lib/formatters";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function PaymentBreakdownBar({ orders }: { orders: any[] }) {
  if (!orders || orders.length === 0) return <p className="text-sm text-slate-400">No orders</p>;
  const cash = orders.reduce((s, o) => s + (o.payments?.filter((p: any) => p.method === 'CASH').reduce((a: number, p: any) => a + p.amount, 0) || 0), 0);
  const card = orders.reduce((s, o) => s + (o.payments?.filter((p: any) => p.method === 'CARD').reduce((a: number, p: any) => a + p.amount, 0) || 0), 0);
  const total = cash + card;
  if (total === 0) return <p className="text-sm text-slate-400">No payments</p>;
  const cashPct = Math.round((cash / total) * 100);
  const cardPct = Math.round((card / total) * 100);
  return (
    <div className="space-y-4">
      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
        {cashPct > 0 && <div style={{ width: `${cashPct}%` }} className="h-full bg-emerald-500" />}
        {cardPct > 0 && <div style={{ width: `${cardPct}%` }} className="h-full bg-blue-500" />}
      </div>
      <div className="flex items-center gap-6">
        {cashPct > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-slate-700">Cash {cashPct}%</span>
          </div>
        )}
        {cardPct > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-slate-700">Card {cardPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "0m";
  if (ms < 60_000) return "< 1m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function WaiterPerformance({ stats }: { stats: any[] }) {
  if (!stats || stats.length === 0) return null;
  const list = [...stats].sort((a, b) => b._sum.netAmount - a._sum.netAmount);
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Waiter Performance</h2>
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr><th className="px-5 py-3.5">Waiter</th><th className="px-5 py-3.5">Orders</th><th className="px-5 py-3.5 text-right">Revenue</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {list.map((w, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                    {(w.assignedWaiterName || 'U').charAt(0).toUpperCase()}
                  </div>
                  {w.assignedWaiterName || 'Unknown'}
                </td>
                <td className="px-5 py-3.5 text-slate-600 font-medium">{w._count.id}</td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatPKR(w._sum.netAmount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftDetailPage() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const router = useRouter();
  const { role } = useUser();
  const isTenantAdmin = role === "TENANT_ADMIN" || role === "SUPER_ADMIN";

  useTick(60_000);

  const [activityPage, setActivityPage] = useState(1);

  // Queries
  const { data: shift, isLoading: isShiftLoading } = useQuery({
    queryKey: ["shift-detail", shiftId],
    queryFn: () => apiGet<any>(`/api/shifts/${shiftId}`),
    enabled: !!shiftId,
  });

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["shift-orders", shiftId],
    queryFn: () => apiGet<any>(`/api/shifts/${shiftId}/orders`),
    enabled: !!shiftId,
  });

  const { data: activityData, isLoading: isActivityLoading } = useQuery({
    queryKey: ["shift-activity", shiftId, activityPage],
    queryFn: () => apiGet<any>(`/api/shifts/${shiftId}/activity`, { page: String(activityPage), limit: "20" }),
    enabled: !!shiftId,
  });

  if (isShiftLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-[1200px] mx-auto space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 mb-1">Shift not found</h2>
          <p className="text-sm text-slate-500 mb-4">This shift does not exist or you lack permission to view it.</p>
          <button onClick={() => router.push("/dashboard/shifts")} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            Return to Shifts
          </button>
        </div>
      </div>
    );
  }

  // Financial metrics
  const openFloat = Number(shift.openingFloat ?? 0);
  const totalSales = Number(shift.totalSales ?? 0);
  const totalCash = Number(shift.totalCash ?? 0);
  const totalCard = Number(shift.totalCard ?? 0);
  const closingCash = Number(shift.closingCash ?? 0);
  const variance = Number(shift.cashVariance ?? 0);
  
  const cashIn = (shift.cashEntries ?? []).filter((e: any) => e.type === "CASH_IN").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const cashOut = (shift.cashEntries ?? []).filter((e: any) => e.type === "CASH_OUT").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const expectedCash = openFloat + totalCash + cashIn - cashOut;

  // Time calculations
  const shiftMs = shift.closedAt
    ? new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()
    : Date.now() - new Date(shift.openedAt).getTime();

  // Fix: handle sub-minute breaks by always falling back to actual MS if endedAt is present
  const totalBreakMs = (shift.breaks ?? []).reduce((s: number, b: any) => {
    if (b.endedAt) {
      const ms = new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime();
      return s + ms;
    }
    return s + (Date.now() - new Date(b.startedAt).getTime());
  }, 0);
  const activeMs = Math.max(0, shiftMs - totalBreakMs);

  const orders = ordersData?.orders ?? [];
  const activities = activityData?.events ?? [];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page Header ── */}
      <div className="border-b border-slate-100">
        <div className="max-w-[1200px] mx-auto px-8 py-6">
          <button 
            onClick={() => router.push("/dashboard/shifts")} 
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Shift Management
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">
                {fmtDate(shift.openedAt)}
              </p>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
                Shift #{shiftId.slice(-6).toUpperCase()}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  shift.closedReason ? "bg-amber-50 text-amber-600 border-amber-200" :
                  shift.status === "OPEN" ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                  : shift.status === "ABANDONED" ? "bg-red-50 text-red-700 border-red-100"
                  : "bg-slate-50 text-slate-600 border-slate-200"
                }`}>
                  {shift.closedReason ? "Force Closed" : shift.status === "OPEN" ? "Open" : shift.status === "ABANDONED" ? "Abandoned" : "Closed"}
                </span>
              </h1>
              
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{shift.user?.name ?? "Cashier"}</span>
                <span className="text-slate-300">•</span>
                <span>{fmtTime(shift.openedAt)} — {shift.closedAt ? fmtTime(shift.closedAt) : "Now"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-10">
        
        {shift.closedReason && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">This shift was force-closed</h3>
              <p className="text-sm text-amber-800 mt-1">Reason: {shift.closedReason}</p>
            </div>
          </div>
        )}

        {/* ── Top Summary Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 border-b border-gray-200 pb-8">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Opening float</p>
            <p className="text-2xl font-black text-gray-900">{formatPKR(openFloat)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total sales</p>
            <p className="text-2xl font-black text-gray-900">{formatPKR(totalSales)}</p>
            <p className="text-[11px] font-medium text-gray-500 mt-1">{shift._count?.orders ?? 0} orders</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Closing cash</p>
            <p className="text-2xl font-black text-gray-900">{shift.closedAt ? formatPKR(closingCash) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Variance</p>
            <p className={`text-2xl font-black ${
              variance === 0 ? "text-gray-900" : variance > 0 ? "text-green-600" : "text-red-600"
            }`}>
              {formatVariance(variance)}
            </p>
          </div>
        </div>

        {/* ── Sections Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Main Content (Left, 2 cols) */}
          <div className="lg:col-span-2 space-y-10">
            
            {/* Cash Reconciliation */}
            <section>
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                Cash Reconciliation
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm shadow-sm">
                <div className="grid grid-cols-2">
                  {/* Expected */}
                  <div className="p-6 bg-gray-50 border-r border-gray-200">
                    <p className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-6">Expected</p>
                    <div className="space-y-4">
                      <div className="flex justify-between text-gray-600 font-medium"><span>Opening float</span> <span>{formatPKR(openFloat)}</span></div>
                      <div className="flex justify-between text-gray-600 font-medium"><span>Cash sales</span> <span>{formatPKR(totalCash)}</span></div>
                      {cashIn > 0 && <div className="flex justify-between text-gray-600 font-medium"><span>Cash ins</span> <span>{formatPKR(cashIn)}</span></div>}
                      {cashOut > 0 && <div className="flex justify-between text-gray-600 font-medium"><span>Cash outs</span> <span className="text-red-600">-{formatPKR(cashOut)}</span></div>}
                      <div className="pt-4 mt-2 border-t border-gray-300 flex justify-between font-black text-gray-900">
                        <span>Expected total</span>
                        <span>{formatPKR(expectedCash)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Actual */}
                  <div className="p-6 bg-white">
                    <p className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-6">Counted</p>
                    <div className="space-y-4">
                      <div className="flex justify-between text-gray-600 font-medium"><span>Cashier counted</span> <span>{formatPKR(closingCash)}</span></div>
                      <div className="pt-4 mt-4 border-t border-gray-200 flex justify-between font-black text-gray-900">
                        <span>Variance</span>
                        <span className={variance === 0 ? "text-gray-400" : variance > 0 ? "text-green-600" : "text-red-600"}>
                          {formatVariance(variance)}
                        </span>
                      </div>
                    </div>
                    {/* Denominations */}
                    {(shift.denominations ?? []).length > 0 && (
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-medium text-slate-400 mb-2">Denominations</p>
                        <div className="space-y-1">
                          {shift.denominations.map((d: any) => (
                            <div key={d.id} className="flex justify-between text-xs text-slate-500">
                              <span>{formatPKR(d.denomination)} × {d.quantity}</span>
                              <span className="font-medium text-slate-700">{formatPKR(d.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Time & Breaks */}
            <section className="grid grid-cols-3 gap-6">
              <div className="border border-gray-200 shadow-sm rounded-lg p-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</p>
                <p className="text-xl font-black text-gray-900">{fmtDuration(shiftMs)}</p>
              </div>
              <div className="border border-gray-200 shadow-sm rounded-lg p-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Active time</p>
                <p className="text-xl font-black text-gray-900">{fmtDuration(activeMs)}</p>
              </div>
              <div className="border border-gray-200 shadow-sm rounded-lg p-6 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Break time</p>
                <p className="text-xl font-black text-gray-900">{fmtDuration(totalBreakMs)}</p>
                {shift.breaks?.length > 0 && (
                  <p className="text-[11px] font-medium text-gray-500 mt-1.5">{shift.breaks.length} break{shift.breaks.length > 1 ? 's' : ''}</p>
                )}
              </div>
            </section>

            {/* Notes */}
            {shift.notes && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Shift Notes</h2>
                <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed border border-slate-200">
                  {shift.notes}
                </div>
              </section>
            )}

            {/* Orders Summary */}
            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Payment Methods</h2>
              <div className="border border-slate-200 rounded-xl p-6">
                {isOrdersLoading ? <div className="h-12 bg-slate-50 animate-pulse rounded" /> : <PaymentBreakdownBar orders={orders} />}
              </div>
            </section>

            {/* Waiter Performance */}
            {shift.waiterStats && shift.waiterStats.length > 0 && (
              <WaiterPerformance stats={shift.waiterStats} />
            )}
          </div>

          {/* Sidebar (Right, 1 col) */}
          <div className="space-y-10">
            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" /> Timeline
              </h2>
              
              <div className="border border-slate-200 rounded-xl bg-white p-5">
                {isActivityLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-50 rounded-md animate-pulse" />)}
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No activity recorded.</p>
                ) : (
                  <div className="relative pl-3 border-l border-slate-100 space-y-6">
                    {activities.map((event: any, i: number) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-slate-300 border-[3px] border-white box-content" />
                        <div className="pl-4">
                          <p className="text-[13px] font-medium text-slate-800 leading-snug">{event.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">{fmtTime(event.time)}</span>
                            {event.amount > 0 && (
                              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {formatPKR(event.amount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {activityData?.hasMore && (
                  <button 
                    onClick={() => setActivityPage(p => p + 1)} 
                    className="w-full mt-6 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Load More <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </section>
          </div>
          
        </div>
      </div>
    </div>
  );
}
