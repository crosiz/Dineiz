"use client";
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { apiGet } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users, TrendingUp, RefreshCw, Eye } from "lucide-react";

function formatDuration(startMs: number) {
  const ms = Date.now() - startMs;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const BRANCH_COLORS = ["bg-violet-100 text-violet-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-orange-100 text-orange-700","bg-pink-100 text-pink-700"];

export default function LiveShiftsPage() {
  const router = useRouter();
  const { branchId: userBranchId } = useUser();

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["shift-stats-active-live", userBranchId],
    queryFn: () => apiGet<any>("/api/shifts/stats/active", userBranchId ? { branchId: userBranchId } : {}),
    refetchInterval: 30_000,
  });

  const shifts: any[] = data?.shifts ?? [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3 text-sm text-slate-400 mb-4">
          <button onClick={() => router.push("/dashboard/shifts")} className="flex items-center gap-1.5 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Shift Management
          </button>
          <span>/</span>
          <span className="text-slate-700 font-medium">Live Shifts</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Live Shifts Monitor</h1>
            <p className="text-sm text-slate-400 mt-0.5">Auto-refreshes every 30 seconds · Last updated: {lastUpdated}</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh Now
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Active Shifts", value: isLoading ? "—" : String(data?.count ?? 0), icon: <Clock className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50 border-emerald-200" },
            { label: "Combined Earnings", value: isLoading ? "—" : formatPKR(data?.combinedEarnings ?? 0), icon: <TrendingUp className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50 border-blue-200" },
            { label: "Staff Working", value: isLoading ? "—" : String(data?.uniqueCashiers ?? 0), icon: <Users className="w-5 h-5 text-violet-600" />, bg: "bg-violet-50 border-violet-200" },
          ].map((c, i) => (
            <div key={i} className={`${c.bg} border rounded-2xl p-5 flex items-center gap-4`}>
              <div className="p-2.5 bg-white rounded-xl shadow-sm">{c.icon}</div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Shifts table */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white border border-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : shifts.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center">
            <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-bold text-slate-600 text-lg">No Active Shifts</h3>
            <p className="text-slate-400 text-sm mt-1">All cashiers are clocked out.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Cashier", "Branch", "Started At", "Duration", "Cash", "Digital", "Total Sales", "Orders", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shifts.map((s: any, i: number) => {
                  const stats = s.liveStats ?? {};
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                            {(s.user?.name ?? "?").substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-slate-900">{s.user?.name ?? "Cashier"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${BRANCH_COLORS[i % BRANCH_COLORS.length]}`}>
                          {s.branchId?.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 font-mono">
                        {new Date(s.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-slate-700">{formatDuration(new Date(s.openedAt).getTime())}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-700 font-semibold whitespace-nowrap">{formatPKR(stats.cashTotal ?? 0)}</td>
                      <td className="px-4 py-4 text-xs text-slate-700 font-semibold whitespace-nowrap">{formatPKR(stats.digitalTotal ?? 0)}</td>
                      <td className="px-4 py-4 text-xs font-black text-slate-900 whitespace-nowrap">{formatPKR(stats.totalSales ?? 0)}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{stats.totalOrders ?? 0}</td>
                      <td className="px-4 py-4">
                        <button onClick={() => router.push(`/dashboard/shifts/${s.id}`)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors opacity-0 group-hover:opacity-100">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
