"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { useDashboardContext } from "@/contexts/dashboard-context";
import { apiGet } from "@/lib/api-client";
import { apiFetch, API_URL } from "@/lib/api";
import { formatPKR, formatVariance } from "@/lib/formatters";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock, RefreshCw, Download, Search, Eye, X, ChevronRight,
} from "lucide-react";
import { useTick } from "@/lib/hooks";
import { io } from "socket.io-client";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { AllBranchesBanner } from "@/components/AllBranchesBanner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}
function fmtDuration(ms: number) {
  if (ms < 60_000) return "< 1 min";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Live Timers ──────────────────────────────────────────────────────────────

// useTick imported from lib/hooks

function LiveDuration({ openedAt }: { openedAt: string }) {
  useTick(60_000);
  return <span>{fmtDuration(Date.now() - new Date(openedAt).getTime())}</span>;
}

function BreakDuration({ startedAt }: { startedAt: string | null }) {
  useTick(60_000);
  if (!startedAt) return <span>—</span>;
  const ms = Date.now() - new Date(startedAt).getTime();
  return <span>{fmtDuration(ms)}</span>;
}

// ─── Force Close Modal ────────────────────────────────────────────────────────

function ForceCloseModal({ shiftId, cashierName, onClose, onSuccess }: {
  shiftId: string; cashierName: string; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Please enter a reason."); return; }
    if (pin.length < 4) { setError("Manager PIN must be at least 4 digits."); return; }
    setLoading(true);
    try {
      await apiFetch(`/api/shifts/${shiftId}/force-close`, {
        method: "PUT",
        body: JSON.stringify({ notes: `FORCE CLOSED by manager. Reason: ${reason}`, actualCash: 0 }),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to force close.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Force Close Shift</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Closing <strong className="text-slate-700">{cashierName}</strong>'s shift. This action is logged.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Cashier left without closing…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Manager PIN *</label>
            <input
              type="password"
              maxLength={8}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4-digit PIN"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              {loading ? "Closing…" : "Force Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live Shift Row ────────────────────────────────────────────────────────────

function LiveShiftRow({ shift, isTenantAdmin, onForceClose }: {
  shift: any; isTenantAdmin: boolean; onForceClose: (id: string, name: string) => void;
}) {
  const router = useRouter();
  const stats = shift.liveStats ?? {};
  const breakStats = shift.breakStats ?? {};
  const onBreak = breakStats.onBreak === true;

  return (
    <tr
      onClick={() => router.push(`/dashboard/shifts/${shift.id}`)}
      className="group border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors last:border-0"
    >
      {/* Cashier */}
      <td className="py-3.5 pl-6 pr-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-700 shrink-0">
            {(shift.user?.name ?? "?").substring(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-800">{shift.user?.name ?? "Cashier"}</span>
        </div>
      </td>
      {/* Status */}
      <td className="py-3.5 px-3">
        {onBreak ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            On break · <BreakDuration startedAt={breakStats.currentBreakStartedAt} />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Active
          </span>
        )}
      </td>
      {/* Duration */}
      <td className="py-3.5 px-3 text-xs text-slate-500 tabular-nums">
        <LiveDuration openedAt={shift.openedAt} />
      </td>
      {/* Opened */}
      <td className="py-3.5 px-3 text-xs text-slate-400 tabular-nums">{fmtTime(shift.openedAt)}</td>
      {/* Sales */}
      <td className="py-3.5 px-3 text-sm font-semibold text-slate-800 tabular-nums">
        {formatPKR(stats.totalSales ?? 0)}
      </td>
      {/* Cash / Digital */}
      <td className="py-3.5 px-3 text-xs text-slate-400 tabular-nums">
        {formatPKR(stats.cashTotal ?? 0)}
      </td>
      <td className="py-3.5 px-3 text-xs text-slate-400 tabular-nums">
        {formatPKR(stats.digitalTotal ?? 0)}
      </td>
      {/* Orders */}
      <td className="py-3.5 px-3 text-xs text-slate-500 tabular-nums">{stats.totalOrders ?? 0}</td>
      {/* Float */}
      <td className="py-3.5 px-3 text-xs text-slate-400 tabular-nums">{formatPKR(shift.openingFloat ?? 0)}</td>
      {/* Actions */}
      <td className="py-3.5 pl-3 pr-6 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); router.push(`/dashboard/shifts/${shift.id}`); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-white transition-colors"
          >
            <Eye className="w-3 h-3" /> View
          </button>
          {isTenantAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onForceClose(shift.id, shift.user?.name ?? "Cashier"); }}
              className="px-2.5 py-1 text-xs font-medium text-red-500 border border-red-100 rounded-md hover:bg-red-50 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShiftManagementPage() {
  const router = useRouter();
  const { role, branchId: userBranchId, tenantId } = useUser();
  const { selectedBranchId } = useDashboardContext();
  const isTenantAdmin = role === "TENANT_ADMIN" || role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const { isAllBranches } = useBranchFilter();

  const effectiveBranchId = isTenantAdmin 
    ? (selectedBranchId === 'all' ? undefined : selectedBranchId)
    : userBranchId;

  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [forceCloseTarget, setForceCloseTarget] = useState<{ id: string; name: string } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Live data
  const { data: liveData, isLoading: isLiveLoading, refetch: refetchLive } = useQuery({
    queryKey: ["shift-stats-active", effectiveBranchId],
    queryFn: () => apiGet<any>("/api/shifts/stats/active", effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    refetchInterval: 60_000,
    enabled: activeTab === "live",
  });

  // History data
  const historyParams: Record<string, string> = { limit: "100" };
  if (effectiveBranchId) historyParams.branchId = effectiveBranchId;
  if (dateFrom) historyParams.from = dateFrom;
  if (dateTo) historyParams.to = dateTo;

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["shift-history", effectiveBranchId, dateFrom, dateTo, filterStatus, filterSearch],
    queryFn: () => apiGet<any>("/api/shifts", historyParams),
    enabled: activeTab === "history",
  });

  const liveShifts: any[] = liveData?.shifts ?? [];
  const allHistory: any[] = historyData?.data ?? [];

  useEffect(() => {
    const socket = io(`${API_URL}/kds`, { withCredentials: true, transports: ['websocket', 'polling'] });
    
    socket.on('connect', () => { 
      if (userBranchId) socket.emit('join_branch', userBranchId); 
      else if (isTenantAdmin && tenantId) socket.emit('join_tenant', tenantId);
    });
    
    const refetchShifts = () => {
      queryClient.refetchQueries({ queryKey: ["shift-stats-active"] });
      queryClient.refetchQueries({ queryKey: ["shift-history"] });
    };

    socket.on('dashboard:stats_updated', refetchShifts);
    // Automatic ZKTeco clock-in/out also opens/closes shifts — refresh the
    // same queries so biometric attendance shows up here live too.
    socket.on('shift:opened', refetchShifts);
    socket.on('shift:closed', refetchShifts);

    return () => { socket.disconnect(); };
  }, [userBranchId, tenantId, isTenantAdmin, queryClient]);

  const historyShifts = allHistory.filter((s: any) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterSearch && !`${s.user?.name}`.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // Summary metrics
  const totalRevenue = historyShifts.reduce((s: number, sh: any) => s + Number(sh.totalSales ?? 0), 0);
  const totalVariance = historyShifts.reduce((s: number, sh: any) => s + Number(sh.cashVariance ?? 0), 0);
  const closedShifts = historyShifts.filter((s: any) => s.closedAt);
  const avgDurationMs = closedShifts.length
    ? closedShifts.reduce((s: number, sh: any) =>
        s + (new Date(sh.closedAt).getTime() - new Date(sh.openedAt).getTime()), 0) / closedShifts.length
    : 0;

  const exportCSV = () => {
    const headers = ["Date", "Cashier", "Opened", "Closed", "Duration", "Float", "Sales", "Cash", "Digital", "Closing Cash", "Variance", "Status"];
    const rows = historyShifts.map((s: any) => [
      fmtDate(s.openedAt), s.user?.name ?? "", fmtTime(s.openedAt),
      s.closedAt ? fmtTime(s.closedAt) : "Open",
      s.closedAt ? fmtDuration(new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) : "—",
      s.openingFloat ?? 0, s.totalSales ?? 0, s.totalCash ?? 0, s.totalCard ?? 0,
      s.closingCash ?? 0, s.cashVariance ?? 0, s.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "shifts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      {forceCloseTarget && (
        <ForceCloseModal
          shiftId={forceCloseTarget.id}
          cashierName={forceCloseTarget.name}
          onClose={() => setForceCloseTarget(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["shift-stats-active"] })}
        />
      )}

      {/* ── Page header ── */}
      <div className="border-b border-slate-100 px-8 pt-7 pb-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Shifts</h1>
            <p className="text-sm text-slate-400 mt-0.5">Track cashier sessions, earnings, and cash reconciliation</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "live" && (
              <button
                onClick={() => refetchLive()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            )}
            {activeTab === "history" && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Underline tabs */}
        <div className="flex gap-6">
          {[
            { key: "live", label: "Live" },
            { key: "history", label: "History" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
              {tab.key === "live" && !isLiveLoading && (
                <span className="ml-1.5 text-xs text-slate-400">
                  {liveData?.count ?? 0} active
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        <AllBranchesBanner isAllBranches={isAllBranches} />

        {/* ══════════════════ LIVE TAB ══════════════════ */}
        {activeTab === "live" && (
          <>
            {/* Summary row */}
            {!isLiveLoading && (
              <div className="flex items-center gap-8 py-4 border-b border-gray-200">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Active shifts</p>
                  <p className="text-2xl font-black text-gray-900">{liveData?.count ?? 0}</p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Combined earnings</p>
                  <p className="text-2xl font-black text-gray-900">{formatPKR(liveData?.combinedEarnings ?? 0)}</p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Staff on floor</p>
                  <p className="text-2xl font-black text-gray-900">{liveData?.uniqueCashiers ?? 0}</p>
                </div>
              </div>
            )}

            {/* Live shifts table */}
            {isLiveLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : liveShifts.length === 0 ? (
              <div className="py-20 text-center">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No active shifts right now</p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Cashier", "Status", "Duration", "Since", "Sales", "Cash", "Digital", "Orders", "Float", ""].map(h => (
                        <th key={h} className={`py-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wide ${h === "" ? "pl-3 pr-6 text-right" : "px-3"} ${h === "Cashier" ? "pl-6" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveShifts.map((shift: any, i: number) => (
                      <LiveShiftRow
                        key={shift.id}
                        shift={shift}
                        isTenantAdmin={isTenantAdmin}
                        onForceClose={(id, name) => setForceCloseTarget({ id, name })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ HISTORY TAB ══════════════════ */}
        {activeTab === "history" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-300" />
                <input
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Search cashier…"
                  className="text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-300 w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white text-slate-600"
              >
                <option value="">All statuses</option>
                <option value="CLOSED">Closed</option>
                <option value="OPEN">Open</option>
                <option value="ABANDONED">Abandoned</option>
              </select>
              {(filterSearch || filterStatus) && (
                <button
                  onClick={() => { setFilterSearch(""); setFilterStatus(""); }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Summary metrics */}
            {!isHistoryLoading && historyShifts.length > 0 && (
              <div className="flex items-center gap-8 py-4 border-b border-gray-200">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">{historyShifts.length} shifts</p>
                  <p className="text-xl font-black text-gray-900">{formatPKR(totalRevenue)}</p>
                  <p className="text-[11px] text-gray-500 font-medium">total revenue</p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Avg duration</p>
                  <p className="text-xl font-black text-gray-900">
                    {avgDurationMs > 0 ? fmtDuration(avgDurationMs) : "—"}
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Net variance</p>
                  <p className={`text-xl font-black ${totalVariance === 0 ? "text-gray-900" : totalVariance > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatVariance(totalVariance)}
                  </p>
                </div>
              </div>
            )}

            {/* History table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Date", "Cashier", "Opened", "Closed", "Duration", "Float", "Sales", "Cash", "Digital", "Variance", "Status", ""].map(h => (
                      <th
                        key={h}
                        className={`py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap ${h === "" ? "pr-4 text-right" : "px-4"} ${h === "Date" ? "pl-5" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isHistoryLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 12 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3.5 bg-slate-100 rounded animate-pulse w-14" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : historyShifts.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-sm text-slate-400">
                        No shifts found
                      </td>
                    </tr>
                  ) : (
                    historyShifts.map((s: any) => {
                      const variance = Number(s.cashVariance ?? 0);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => router.push(`/dashboard/shifts/${s.id}`)}
                          className="group hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 pl-5 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(s.openedAt)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">
                                {(s.user?.name ?? "?").substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{s.user?.name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{fmtTime(s.openedAt)}</td>
                          <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                            {s.closedAt ? fmtTime(s.closedAt) : <span className="text-emerald-500">Open</span>}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                            {s.closedAt
                              ? fmtDuration(new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime())
                              : <LiveDuration openedAt={s.openedAt} />}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                            {formatPKR(Number(s.openingFloat ?? 0))}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap tabular-nums">
                            {formatPKR(Number(s.totalSales ?? 0))}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                            {formatPKR(Number(s.totalCash ?? 0))}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                            {formatPKR(Number(s.totalCard ?? 0))}
                          </td>
                          <td className="py-3 px-4 text-xs whitespace-nowrap tabular-nums">
                            <span className={
                              variance === 0 ? "text-slate-400"
                              : variance > 0 ? "text-emerald-600 font-medium"
                              : "text-red-500 font-medium"
                            }>
                              {formatVariance(variance)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${
                              s.closedReason ? "bg-amber-50 text-amber-600 border border-amber-200" :
                              s.status === "OPEN" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                              s.status === "ABANDONED" ? "bg-red-50 text-red-600 border border-red-200" :
                              "bg-slate-50 text-slate-500 border border-slate-200"
                            }`}>
                              {s.closedReason ? "Force Closed" : s.status === "OPEN" ? "Open" : s.status === "ABANDONED" ? "Abandoned" : "Closed"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors inline" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
