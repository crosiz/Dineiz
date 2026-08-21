"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { useDashboardContext } from "@/contexts/dashboard-context";
import { apiGet } from "@/lib/api-client";
import { apiFetch, API_URL } from "@/lib/api";
import { formatPKR, formatVariance } from "@/lib/formatters";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Clock, RefreshCw, Download, Search, X, ChevronRight } from "lucide-react";
import { useTick } from "@/lib/hooks";
import { io } from "socket.io-client";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { AllBranchesBanner } from "@/components/AllBranchesBanner";
import {
  ShiftDateRange,
  resolveShiftRange,
  describeShiftRange,
  type ShiftDatePreset,
} from "@/components/features/shifts/ShiftDateRange";
import { ShiftPdfButton } from "@/components/features/shifts/ShiftPdfButton";
import { Pagination } from "@/components/ui/Pagination";

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
function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function LiveDuration({ openedAt }: { openedAt: string }) {
  useTick(60_000);
  return <span>{fmtDuration(Date.now() - new Date(openedAt).getTime())}</span>;
}

function BreakDuration({ startedAt }: { startedAt: string | null }) {
  useTick(60_000);
  if (!startedAt) return <span>—</span>;
  return <span>{fmtDuration(Date.now() - new Date(startedAt).getTime())}</span>;
}

function StatusPill({ shift }: { shift: any }) {
  const [label, tone] = shift.closedReason
    ? ["Force closed", "bg-amber-50 text-amber-700 border-amber-200"]
    : shift.status === "OPEN"
    ? ["Open", "bg-emerald-50 text-emerald-700 border-emerald-200"]
    : shift.status === "ABANDONED"
    ? ["Abandoned", "bg-red-50 text-red-600 border-red-200"]
    : ["Closed", "bg-slate-50 text-slate-500 border-slate-200"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${tone}`}>
      {label}
    </span>
  );
}

/** Compact label/value pair used in the summary strips. */
function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-10 flex-wrap py-4 border-b border-slate-100">{children}</div>
  );
}

function Avatar({ name }: { name?: string | null }) {
  return (
    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 shrink-0">
      {(name ?? "?").substring(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Force Close Modal ────────────────────────────────────────────────────────

function ForceCloseModal({ shiftId, cashierName, onClose, onSuccess }: {
  shiftId: string; cashierName: string; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (reason.trim().length < 3) { setError("Please give a reason — it is recorded on the shift."); return; }
    setLoading(true);
    setError("");
    try {
      // `reason` goes to the server as the shift's closedReason, not buried in
      // free-text notes. Leaving the cash box blank records the drawer as
      // never counted rather than as zero, which would otherwise show up as a
      // shortage the size of the whole day's cash.
      await apiFetch(`/api/shifts/${shiftId}/force-close`, {
        method: "PUT",
        body: JSON.stringify({
          reason: reason.trim(),
          ...(countedCash.trim() !== "" ? { actualCash: Number(countedCash) } : {}),
        }),
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
          <h3 className="text-base font-semibold text-slate-900">Force close shift</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Ends <strong className="text-slate-700">{cashierName}</strong>&apos;s shift immediately, even if orders are still
          unsettled. The reason is stored on the shift and shown in its report.
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Counted cash <span className="font-normal text-slate-400">— leave blank if nobody counted the drawer</span>
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={countedCash}
              onChange={e => setCountedCash(e.target.value)}
              placeholder="Not counted"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              {loading ? "Closing…" : "Force close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live tab ─────────────────────────────────────────────────────────────────

function LiveShiftRow({ shift, showBranch, isTenantAdmin, onForceClose }: {
  shift: any; showBranch: boolean; isTenantAdmin: boolean; onForceClose: (id: string, name: string) => void;
}) {
  const router = useRouter();
  const stats = shift.liveStats ?? {};
  const breakStats = shift.breakStats ?? {};
  const onBreak = breakStats.onBreak === true;

  return (
    <tr
      onClick={() => router.push(`/dashboard/shifts/${shift.id}`)}
      className="group border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-colors last:border-0"
    >
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={shift.user?.name} />
          <span className="text-sm font-medium text-slate-800">{shift.user?.name ?? "Cashier"}</span>
        </div>
      </td>
      {showBranch && (
        <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">{shift.branch?.name ?? "—"}</td>
      )}
      <td className="py-3 px-3">
        {onBreak ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium whitespace-nowrap">
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
      <td className="py-3 px-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
        <LiveDuration openedAt={shift.openedAt} />
      </td>
      <td className="py-3 px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">{fmtTime(shift.openedAt)}</td>
      <td className="py-3 px-3 text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap">
        {formatPKR(stats.totalSales ?? 0)}
      </td>
      <td className="py-3 px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">{formatPKR(stats.cashTotal ?? 0)}</td>
      <td className="py-3 px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">{formatPKR(stats.digitalTotal ?? 0)}</td>
      <td className="py-3 px-3 text-xs text-slate-500 tabular-nums">{stats.totalOrders ?? 0}</td>
      <td className="py-3 px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">
        {breakStats.breakCount ?? 0} · {breakStats.totalBreakMinutes ?? 0}m
      </td>
      <td className="py-3 px-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">{formatPKR(shift.openingFloat ?? 0)}</td>
      <td className="py-3 pl-3 pr-5 text-right">
        <div className="flex items-center justify-end gap-1">
          {/* An open shift still produces a valid interim report — managers use
              it for mid-day cash drops, so it is offered here too. */}
          <ShiftPdfButton shiftId={shift.id} />
          {isTenantAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onForceClose(shift.id, shift.user?.name ?? "Cashier"); }}
              className="px-2 py-1 text-xs font-medium text-red-500 rounded-md hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Force close
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────


export default function ShiftManagementPage() {
  const router = useRouter();
  const { role, branchId: userBranchId, tenantId } = useUser();
  const { selectedBranchId, selectedBranchName, setSelectedBranchId } = useDashboardContext();
  const isTenantAdmin = role === "TENANT_ADMIN" || role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const { isAllBranches } = useBranchFilter();

  // A branch manager is pinned to their own branch; a tenant admin follows the
  // global branch switcher, where null means "all branches".
  const effectiveBranchId = (isTenantAdmin ? selectedBranchId : userBranchId) ?? undefined;
  const showBranchColumn = !effectiveBranchId;

  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [forceCloseTarget, setForceCloseTarget] = useState<{ id: string; name: string } | null>(null);

  // ── History filters ─────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<ShiftDatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change puts you back on page one — otherwise you can land on
  // "page 4 of 1" and see an empty table.
  useEffect(() => { setPage(1); }, [preset, customFrom, customTo, status, searchDebounced, effectiveBranchId, pageSize]);

  const range = useMemo(
    () => resolveShiftRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  // A custom range isn't a range until both ends are picked; querying on a
  // half-filled one would flash unrelated results.
  const rangeReady = preset !== "custom" || (!!customFrom && !!customTo);

  const historyParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(pageSize) };
    if (effectiveBranchId) p.branchId = effectiveBranchId;
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    if (status) p.status = status;
    if (searchDebounced) p.search = searchDebounced;
    return p;
  }, [page, pageSize, effectiveBranchId, range.from, range.to, status, searchDebounced]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: liveData, isLoading: isLiveLoading, isFetching: isLiveFetching, refetch: refetchLive } = useQuery({
    queryKey: ["shift-stats-active", effectiveBranchId],
    queryFn: () => apiGet<any>("/api/shifts/stats/active", effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    refetchInterval: 60_000,
    enabled: activeTab === "live",
  });

  const { data: historyData, isLoading: isHistoryLoading, isFetching: isHistoryFetching } = useQuery({
    queryKey: ["shift-history", historyParams],
    queryFn: () => apiGet<any>("/api/shifts", historyParams),
    enabled: activeTab === "history" && rangeReady,
    // Keeps the table on screen while a new page or filter loads, instead of
    // collapsing to skeletons on every keystroke.
    placeholderData: keepPreviousData,
  });

  const liveShifts: any[] = liveData?.shifts ?? [];
  const shifts: any[] = historyData?.data ?? [];
  const summary = historyData?.summary;
  const pagination = historyData?.pagination;
  const byBranch: any[] = historyData?.byBranch ?? [];
  const onBreakCount = liveShifts.filter((s) => s.breakStats?.onBreak).length;

  useEffect(() => {
    const socket = io(`${API_URL}/kds`, { withCredentials: true, transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      if (userBranchId) socket.emit("join_branch", userBranchId);
      else if (isTenantAdmin && tenantId) socket.emit("join_tenant", tenantId);
    });

    const refetchShifts = () => {
      queryClient.invalidateQueries({ queryKey: ["shift-stats-active"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
    };

    socket.on("dashboard:stats_updated", refetchShifts);
    // ZKTeco clock-in/out opens and closes shifts too, so biometric
    // attendance shows up here live without a manual refresh.
    socket.on("shift:opened", refetchShifts);
    socket.on("shift:closed", refetchShifts);
    socket.on("shift:break_event", refetchShifts);

    return () => { socket.disconnect(); };
  }, [userBranchId, tenantId, isTenantAdmin, queryClient]);

  // ── CSV export ──────────────────────────────────────────────────────────────
  // Exports the whole filtered range, not just the page on screen — a CSV that
  // silently stopped at 25 rows would be worse than no CSV.
  const exportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows: any[] = [];
      const LIMIT = 200;
      for (let p = 1; p <= 20; p++) {
        const chunk = await apiGet<any>("/api/shifts", { ...historyParams, page: String(p), limit: String(LIMIT) });
        rows.push(...(chunk?.data ?? []));
        if (!chunk?.pagination || p >= chunk.pagination.pages) break;
      }

      const headers = ["Date", "Branch", "Cashier", "Opened", "Closed", "Duration", "Float", "Sales", "Cash", "Digital", "Orders", "Closing cash", "Variance", "Status"];
      const cell = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const body = rows.map((s: any) => [
        fmtDate(s.openedAt), s.branch?.name ?? "", s.user?.name ?? "", fmtTime(s.openedAt),
        s.closedAt ? fmtTime(s.closedAt) : "Open",
        s.closedAt ? fmtDuration(new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) : "",
        s.openingFloat ?? 0, s.totalSales ?? 0, s.totalCash ?? 0, s.totalCard ?? 0,
        s._count?.orders ?? 0, s.closingCash ?? 0, s.cashVariance ?? 0,
        s.closedReason ? "FORCE_CLOSED" : s.status,
      ].map(cell).join(","));

      const csv = [headers.join(","), ...body].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `shifts-${range.from ?? "all"}-to-${range.to ?? "now"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const scopeLabel = effectiveBranchId ? (selectedBranchName || "This branch") : "All branches";

  return (
    <div className="min-h-screen bg-white">
      {forceCloseTarget && (
        <ForceCloseModal
          shiftId={forceCloseTarget.id}
          cashierName={forceCloseTarget.name}
          onClose={() => setForceCloseTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["shift-stats-active"] });
            queryClient.invalidateQueries({ queryKey: ["shift-history"] });
          }}
        />
      )}

      {/* ── Header ── */}
      <div className="border-b border-slate-100 px-8 pt-7 pb-0">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Shift Management</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {scopeLabel} · cashier sessions, breaks, cash reconciliation
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "live" && (
              <button
                onClick={() => refetchLive()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLiveFetching ? "animate-spin" : ""}`} /> Refresh
              </button>
            )}
            {activeTab === "history" && (
              <>
                <ShiftDateRange
                  preset={preset} setPreset={setPreset}
                  customFrom={customFrom} setCustomFrom={setCustomFrom}
                  customTo={customTo} setCustomTo={setCustomTo}
                />
                <button
                  onClick={exportCSV}
                  disabled={exporting || shifts.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> {exporting ? "Exporting…" : "Export CSV"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          {([
            { key: "live", label: "Live" },
            { key: "history", label: "History" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
              {tab.key === "live" && !isLiveLoading && (
                <span className="ml-1.5 text-xs text-slate-400">{liveData?.count ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        <AllBranchesBanner isAllBranches={isAllBranches} />

        {/* ══════════════ LIVE ══════════════ */}
        {activeTab === "live" && (
          <>
            {!isLiveLoading && (
              <StatStrip>
                <Stat label="Active shifts" value={String(liveData?.count ?? 0)} />
                <Stat label="Combined earnings" value={formatPKR(liveData?.combinedEarnings ?? 0)} />
                <Stat label="Staff on floor" value={String(liveData?.uniqueCashiers ?? 0)} />
                <Stat
                  label="On break"
                  value={String(onBreakCount)}
                  tone={onBreakCount > 0 ? "text-amber-600" : undefined}
                />
              </StatStrip>
            )}

            {isLiveLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}
              </div>
            ) : liveShifts.length === 0 ? (
              <div className="py-20 text-center">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No shift is open right now{effectiveBranchId ? " at this branch" : ""}.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      {["Cashier", ...(showBranchColumn ? ["Branch"] : []), "Status", "Duration", "Since", "Sales", "Cash", "Digital", "Orders", "Breaks", "Float", ""].map((h, i) => (
                        <th
                          key={`${h}-${i}`}
                          className={`py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                            h === "" ? "pl-3 pr-5 text-right" : i === 0 ? "pl-5 pr-3" : "px-3"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveShifts.map((shift: any) => (
                      <LiveShiftRow
                        key={shift.id}
                        shift={shift}
                        showBranch={showBranchColumn}
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

        {/* ══════════════ HISTORY ══════════════ */}
        {activeTab === "history" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-300" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search cashier…"
                  className="text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-300 w-36"
                />
              </div>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white text-slate-600 hover:border-slate-300 transition-colors"
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="ABANDONED">Abandoned</option>
              </select>
              <span className="text-xs text-slate-400">
                {describeShiftRange(preset, range.from, range.to)}
              </span>
              {(search || status || preset !== "today") && (
                <button
                  onClick={() => { setSearch(""); setStatus(""); setPreset("today"); setCustomFrom(""); setCustomTo(""); }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {!rangeReady ? (
              <div className="py-20 text-center text-sm text-slate-400">Pick a start and end date to see shifts.</div>
            ) : (
              <>
                {/* Summary over the whole filtered range, not just this page */}
                {summary && (
                  <StatStrip>
                    <Stat
                      label="Shifts"
                      value={String(summary.totalShifts)}
                      hint={summary.openShifts > 0 ? `${summary.openShifts} still open` : undefined}
                    />
                    <Stat label="Net sales" value={formatPKR(summary.totalSales)} hint={`${summary.totalOrders} orders`} />
                    <Stat label="Cash" value={formatPKR(summary.totalCash)} />
                    <Stat label="Digital" value={formatPKR(summary.totalCard)} />
                    <Stat label="Avg duration" value={summary.avgDurationMs > 0 ? fmtDuration(summary.avgDurationMs) : "—"} />
                    <Stat
                      label="Net variance"
                      value={formatVariance(summary.netVariance)}
                      tone={
                        Math.round(summary.netVariance) === 0
                          ? "text-slate-900"
                          : summary.netVariance > 0 ? "text-emerald-600" : "text-red-600"
                      }
                    />
                  </StatStrip>
                )}

                {/* Per-branch rollup — only meaningful when viewing all branches */}
                {showBranchColumn && byBranch.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">By branch</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {byBranch.map((b: any) => (
                        // Clicking a branch drills the whole dashboard into it —
                        // the same thing the global branch switcher does — so the
                        // table below, the summary, and every other page follow.
                        <button
                          key={b.branchId}
                          onClick={() => setSelectedBranchId(b.branchId, b.branchName)}
                          className="text-left border border-slate-200 rounded-lg px-3.5 py-3 hover:border-slate-400 hover:bg-slate-50/60 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-800 truncate">{b.branchName}</p>
                          <div className="flex items-baseline justify-between mt-1.5">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatPKR(b.totalSales)}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums">{b.shifts} shift{b.shifts === 1 ? "" : "s"}</span>
                          </div>
                          {Math.round(b.cashVariance) !== 0 && (
                            <p className={`text-[11px] mt-1 tabular-nums ${b.cashVariance > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatVariance(b.cashVariance)} variance
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60">
                        {["Date", ...(showBranchColumn ? ["Branch"] : []), "Cashier", "Opened", "Closed", "Duration", "Float", "Sales", "Cash", "Digital", "Orders", "Variance", "Status", ""].map((h, i) => (
                          <th
                            key={`${h}-${i}`}
                            className={`py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                              h === "" ? "pr-5 text-right" : i === 0 ? "pl-5 pr-4" : "px-4"
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isHistoryLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: showBranchColumn ? 14 : 13 }).map((_, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-14" /></td>
                            ))}
                          </tr>
                        ))
                      ) : shifts.length === 0 ? (
                        <tr>
                          <td colSpan={showBranchColumn ? 14 : 13} className="py-16 text-center">
                            <p className="text-sm text-slate-400">No shifts in this range.</p>
                            <p className="text-xs text-slate-300 mt-1">Try a wider date range, or “All time”.</p>
                          </td>
                        </tr>
                      ) : (
                        shifts.map((s: any) => {
                          const variance = Number(s.cashVariance ?? 0);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => router.push(`/dashboard/shifts/${s.id}`)}
                              className="group hover:bg-slate-50/70 cursor-pointer transition-colors"
                            >
                              <td className="py-3 pl-5 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(s.openedAt)}</td>
                              {showBranchColumn && (
                                <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap max-w-[160px] truncate">
                                  {s.branch?.name ?? "—"}
                                </td>
                              )}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Avatar name={s.user?.name} />
                                  <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{s.user?.name ?? "—"}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{fmtTime(s.openedAt)}</td>
                              <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                                {s.closedAt ? (
                                  <>
                                    {fmtTime(s.closedAt)}
                                    {/* Night shifts close on the following day. Showing the
                                        time alone made those read as closing before they
                                        opened. */}
                                    {!isSameDay(s.openedAt, s.closedAt) && (
                                      <span className="ml-1 text-slate-300">+1d</span>
                                    )}
                                  </>
                                ) : <span className="text-emerald-600">Open</span>}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                                {s.closedAt
                                  ? fmtDuration(new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime())
                                  : <LiveDuration openedAt={s.openedAt} />}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatPKR(Number(s.openingFloat ?? 0))}</td>
                              <td className="py-3 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap tabular-nums">{formatPKR(Number(s.totalSales ?? 0))}</td>
                              <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatPKR(Number(s.totalCash ?? 0))}</td>
                              <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatPKR(Number(s.totalCard ?? 0))}</td>
                              <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">{s._count?.orders ?? 0}</td>
                              <td className="py-3 px-4 text-xs whitespace-nowrap tabular-nums">
                                <span className={
                                  s.status === "OPEN" ? "text-slate-300"
                                  : variance === 0 ? "text-slate-400"
                                  : variance > 0 ? "text-emerald-600 font-medium"
                                  : "text-red-500 font-medium"
                                }>
                                  {s.status === "OPEN" ? "—" : variance === 0 ? "PKR 0" : formatVariance(variance)}
                                </span>
                              </td>
                              <td className="py-3 px-4"><StatusPill shift={s} /></td>
                              <td className="py-3 pr-5 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <ShiftPdfButton shiftId={s.id} />
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination — the shared control the rest of the dashboard
                    uses. Paging is still server-side; only the chrome is shared. */}
                {pagination && pagination.total > 0 && (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-slate-400 tabular-nums">
                      {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                      {isHistoryFetching && <span className="ml-2 text-slate-300">updating…</span>}
                    </p>
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.pages}
                      onPageChange={setPage}
                      pageSize={pageSize}
                      onPageSizeChange={setPageSize}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
