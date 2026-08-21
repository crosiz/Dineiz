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
  Clock, RefreshCw, Download, Search, Eye, X, ChevronRight, ChevronDown, MoreVertical,
} from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
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

  // Pagination for History Tab
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);

  useEffect(() => {
    setHistoryPage(1);
  }, [filterSearch, filterStatus, dateFrom, dateTo, effectiveBranchId]);

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

  // Pagination calculations
  const totalItems = historyShifts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / historyPageSize));
  const validPage = Math.min(historyPage, totalPages);
  const startIndex = (validPage - 1) * historyPageSize;
  const paginatedShifts = historyShifts.slice(startIndex, startIndex + historyPageSize);
  const startItem = totalItems === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(validPage * historyPageSize, totalItems);

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
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap bg-white">
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 shadow-xs focus-within:bg-white focus-within:border-slate-300 transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Search cashier…"
                  className="text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400 w-36 font-medium"
                />
              </div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 shadow-xs">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="text-xs font-medium bg-transparent outline-none text-slate-700 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 shadow-xs">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="text-xs font-medium bg-transparent outline-none text-slate-700 cursor-pointer"
                />
              </div>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 pr-8 outline-none bg-slate-50/50 text-slate-700 appearance-none cursor-pointer shadow-xs hover:bg-slate-50 transition-colors"
                >
                  <option value="">All statuses</option>
                  <option value="CLOSED">Closed</option>
                  <option value="OPEN">Open</option>
                  <option value="ABANDONED">Abandoned</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {(filterSearch || filterStatus) && (
                <button
                  onClick={() => { setFilterSearch(""); setFilterStatus(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear Filters
                </button>
              )}
            </div>

            {/* Summary metrics */}
            {!isHistoryLoading && historyShifts.length > 0 && (
              <div className="flex items-center gap-8 py-3.5 px-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider font-mono">{historyShifts.length} shifts</p>
                  <p className="text-lg font-black text-slate-900 font-mono">{formatPKR(totalRevenue)}</p>
                  <p className="text-[10px] text-slate-500 font-medium">total revenue</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider font-mono">Avg duration</p>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    {avgDurationMs > 0 ? fmtDuration(avgDurationMs) : "—"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">per shift</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider font-mono">Net variance</p>
                  <p className={`text-lg font-black font-mono ${totalVariance === 0 ? "text-slate-900" : totalVariance > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatVariance(totalVariance)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">cash balance</p>
                </div>
              </div>
            )}

            {/* History table card with bottom pagination */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70">
                      <th className="py-3.5 pl-6 pr-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">SHIFT #</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">DATE & TIME</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">BRANCH</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">CASHIER</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">DURATION</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">FLOAT</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">TOTAL SALES</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">CASH / CARD</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">VARIANCE</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">STATUS</th>
                      <th className="py-3.5 pr-6 pl-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isHistoryLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-4 pl-6 pr-4"><div className="h-4 bg-slate-100 rounded w-20 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-24 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-24 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-28 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-20 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                          <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                          <td className="py-4 pr-6 pl-4 text-right"><div className="h-4 bg-slate-100 rounded w-6 ml-auto animate-pulse" /></td>
                        </tr>
                      ))
                    ) : paginatedShifts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-16 text-center text-sm text-slate-400 font-medium">
                          No shifts found matching criteria
                        </td>
                      </tr>
                    ) : (
                      paginatedShifts.map((s: any) => {
                        const variance = Number(s.cashVariance ?? 0);
                        const branchLabel = s.branch?.name || (effectiveBranchId ? "Current Branch" : "Main Branch");

                        return (
                          <tr
                            key={s.id}
                            onClick={() => router.push(`/dashboard/shifts/${s.id}`)}
                            className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            {/* Shift # */}
                            <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs text-[#FF5722]">
                                #SFT-{s.id.slice(-6).toUpperCase()}
                              </span>
                            </td>

                            {/* Date & Time */}
                            <td className="py-3.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                              {fmtDate(s.openedAt)}, {fmtTime(s.openedAt)}
                            </td>

                            {/* Branch */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-teal-50/80 text-teal-700 border border-teal-200/80 text-[10px] font-bold uppercase font-mono tracking-wider">
                                {branchLabel}
                              </span>
                            </td>

                            {/* Cashier */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                                  {(s.user?.name ?? "?").substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-slate-800">{s.user?.name ?? "—"}</span>
                              </div>
                            </td>

                            {/* Duration */}
                            <td className="py-3.5 px-4 text-xs font-mono text-slate-600 whitespace-nowrap tabular-nums">
                              {s.closedAt
                                ? fmtDuration(new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime())
                                : <LiveDuration openedAt={s.openedAt} />}
                            </td>

                            {/* Float */}
                            <td className="py-3.5 px-4 text-xs text-slate-500 font-mono whitespace-nowrap tabular-nums">
                              PKR {Number(s.openingFloat ?? 0).toLocaleString()}
                            </td>

                            {/* Total Sales */}
                            <td className="py-3.5 px-4 text-xs font-bold text-slate-900 font-mono whitespace-nowrap tabular-nums">
                              PKR {Number(s.totalSales ?? 0).toLocaleString()}
                            </td>

                            {/* Cash / Card */}
                            <td className="py-3.5 px-4 text-xs text-slate-500 font-mono whitespace-nowrap tabular-nums">
                              PKR {Number(s.totalCash ?? 0).toLocaleString()} / PKR {Number(s.totalCard ?? 0).toLocaleString()}
                            </td>

                            {/* Variance */}
                            <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                              {variance === 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-mono font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Balanced
                                </span>
                              ) : variance > 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-mono font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  +PKR {Number(variance).toLocaleString()}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-mono font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  -PKR {Math.abs(Number(variance)).toLocaleString()}
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {s.closedReason ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Force Closed
                                </span>
                              ) : s.status === "OPEN" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Active
                                </span>
                              ) : s.status === "ABANDONED" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Abandoned
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Completed
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 pr-6 pl-4 text-right whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/shifts/${s.id}`);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center"
                                title="View Shift Details"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Navigation / Pagination Footer */}
              <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white flex-wrap gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Showing <span className="font-semibold text-slate-900">{totalItems === 0 ? 0 : `${startItem}-${endItem}`}</span> of{' '}
                  <span className="font-semibold text-slate-900">{totalItems.toLocaleString()}</span> {totalItems === 1 ? 'shift' : 'shifts'}
                </div>
                <div className="flex items-center">
                  <Pagination 
                    currentPage={validPage} 
                    totalPages={totalPages} 
                    onPageChange={setHistoryPage} 
                    pageSize={historyPageSize}
                    onPageSizeChange={(newSize) => {
                      setHistoryPageSize(newSize);
                      setHistoryPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
