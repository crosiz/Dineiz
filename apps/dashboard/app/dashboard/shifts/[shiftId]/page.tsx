"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useTick } from "@/lib/hooks";
import { formatPKR, formatVariance } from "@/lib/formatters";
import { ShiftPdfButton } from "@/components/features/shifts/ShiftPdfButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "0m";
  if (ms < 60_000) return "< 1m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Timeline event styling. Kept small and neutral — the label carries meaning,
 *  the dot only groups related kinds of event at a glance. */
const EVENT_STYLE: Record<string, { label: string; dot: string }> = {
  OPENED: { label: "Shift opened", dot: "bg-emerald-500" },
  CLOSED: { label: "Shift closed", dot: "bg-slate-800" },
  FORCE_CLOSED: { label: "Force closed", dot: "bg-red-500" },
  FORCE_CLOSED_BY_MANAGER: { label: "Force closed by manager", dot: "bg-red-500" },
  BREAK_START: { label: "Break started", dot: "bg-amber-400" },
  BREAK_END: { label: "Break ended", dot: "bg-amber-400" },
  CASH_IN: { label: "Cash in", dot: "bg-sky-500" },
  CASH_OUT: { label: "Cash out", dot: "bg-sky-500" },
  ORDER_COMPLETED: { label: "Order", dot: "bg-slate-300" },
  ORDER_VOIDED: { label: "Void", dot: "bg-red-400" },
  DISCOUNT_APPLIED: { label: "Discount", dot: "bg-violet-400" },
};

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between items-baseline gap-4 ${strong ? "pt-3 mt-1 border-t border-slate-200" : "py-1"}`}>
      <span className={strong ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-500"}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-semibold" : "font-medium"} ${tone ?? "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function StatusPill({ shift }: { shift: any }) {
  const [label, tone] = shift.closedReason
    ? ["Force closed", "bg-amber-50 text-amber-700 border-amber-200"]
    : shift.status === "OPEN"
    ? ["Open", "bg-emerald-50 text-emerald-700 border-emerald-200"]
    : shift.status === "ABANDONED"
    ? ["Abandoned", "bg-red-50 text-red-600 border-red-200"]
    : ["Closed", "bg-slate-50 text-slate-500 border-slate-200"];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${tone}`}>{label}</span>;
}

/** Payment mix across every method actually used, not a fixed cash/card pair. */
const METHOD_COLORS = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-slate-400"];

function PaymentBreakdown({ orders }: { orders: any[] }) {
  const totals = new Map<string, number>();
  for (const o of orders) {
    for (const p of o.payments ?? []) {
      if (p.status && p.status !== "COMPLETED") continue;
      totals.set(p.method ?? "OTHER", (totals.get(p.method ?? "OTHER") ?? 0) + Number(p.amount ?? 0));
    }
  }
  const rows = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);

  if (total === 0) return <p className="text-sm text-slate-400">No payments recorded on this shift.</p>;

  return (
    <div className="space-y-4">
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
        {rows.map(([method, amount], i) => (
          <div key={method} style={{ width: `${(amount / total) * 100}%` }} className={`h-full ${METHOD_COLORS[i % METHOD_COLORS.length]}`} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {rows.map(([method, amount], i) => (
          <div key={method} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${METHOD_COLORS[i % METHOD_COLORS.length]}`} />
            <span className="text-sm text-slate-600">{method}</span>
            <span className="text-sm font-medium text-slate-900 tabular-nums">{formatPKR(amount)}</span>
            <span className="text-xs text-slate-400 tabular-nums">{Math.round((amount / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ORDERS_PER_PAGE = 25;

export default function ShiftDetailPage() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const router = useRouter();

  useTick(60_000);

  const [ordersPage, setOrdersPage] = useState(1);

  const { data: shift, isLoading: isShiftLoading } = useQuery({
    queryKey: ["shift-detail", shiftId],
    queryFn: () => apiGet<any>(`/api/shifts/${shiftId}`),
    enabled: !!shiftId,
  });

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["shift-orders", shiftId, ordersPage],
    queryFn: () => apiGet<any>(`/api/shifts/${shiftId}/orders`, { page: String(ordersPage), limit: String(ORDERS_PER_PAGE) }),
    enabled: !!shiftId,
  });

  // Infinite rather than paged: "Load more" on a timeline should extend it,
  // not replace what you were already reading.
  const {
    data: activityPages,
    isLoading: isActivityLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["shift-activity", shiftId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiGet<any>(`/api/shifts/${shiftId}/activity`, { page: String(pageParam), limit: "30" }),
    getNextPageParam: (last: any) => (last?.hasMore ? last.page + 1 : undefined),
    enabled: !!shiftId,
  });

  if (isShiftLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-[1200px] mx-auto space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton-shimmer rounded-xl" />)}
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
          <p className="text-sm text-slate-500 mb-4">This shift does not exist, or you don&apos;t have permission to view it.</p>
          <button onClick={() => router.push("/dashboard/shifts")} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            Back to Shift Management
          </button>
        </div>
      </div>
    );
  }

  const isOpen = shift.status === "OPEN";

  // ── Money ───────────────────────────────────────────────────────────────────
  const openFloat = Number(shift.openingFloat ?? 0);
  const totalSales = Number(shift.totalSales ?? 0);
  const totalCash = Number(shift.totalCash ?? 0);
  const closingCash = Number(shift.closingCash ?? 0);
  const variance = Number(shift.cashVariance ?? 0);

  const cashEntries: any[] = shift.cashEntries ?? [];
  const cashIn = cashEntries.filter(e => e.type === "CASH_IN").reduce((s, e) => s + Number(e.amount), 0);
  const cashOut = cashEntries.filter(e => e.type === "CASH_OUT").reduce((s, e) => s + Number(e.amount), 0);
  const expectedCash = openFloat + totalCash + cashIn - cashOut;

  const denominations: any[] = shift.denominations ?? [];
  const countedFromDenominations = denominations.reduce((s, d) => s + Number(d.denomination) * Number(d.quantity), 0);

  // ── Time ────────────────────────────────────────────────────────────────────
  const shiftMs = shift.closedAt
    ? new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()
    : Date.now() - new Date(shift.openedAt).getTime();

  const breaks: any[] = shift.breaks ?? [];
  const shiftEndMs = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  // Cap an unfinished break at the end of the shift — see shift-report.data.ts.
  const totalBreakMs = breaks.reduce((s: number, b: any) => {
    const end = Math.min(b.endedAt ? new Date(b.endedAt).getTime() : Date.now(), shiftEndMs);
    return s + Math.max(0, end - new Date(b.startedAt).getTime());
  }, 0);
  const activeMs = Math.max(0, shiftMs - totalBreakMs);

  const orders: any[] = ordersData?.orders ?? [];
  const activities: any[] = (activityPages?.pages ?? []).flatMap((p: any) => p.events ?? []);
  const waiterStats: any[] = shift.waiterStats ?? [];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
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
              <p className="text-sm text-slate-400 mb-1">{fmtDate(shift.openedAt)}</p>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
                Shift {shiftId.slice(-6).toUpperCase()}
                <StatusPill shift={shift} />
              </h1>
              <div className="flex items-center gap-2 mt-2.5 text-sm text-slate-600 flex-wrap">
                <span className="font-medium text-slate-900">{shift.user?.name ?? "Cashier"}</span>
                {shift.branch?.name && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{shift.branch.name}</span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <span className="tabular-nums">{fmtTime(shift.openedAt)} — {shift.closedAt ? fmtTime(shift.closedAt) : "now"}</span>
                <span className="text-slate-300">·</span>
                <span className="tabular-nums">{fmtDuration(shiftMs)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShiftPdfButton shiftId={shiftId} variant="button" label={isOpen ? "Interim PDF" : "Download PDF"} />
              <ShiftPdfButton shiftId={shiftId} variant="button" format="excel" label="Excel" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-10">

        {shift.closedReason && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Force-closed by a manager</h3>
              <p className="text-sm text-amber-800 mt-0.5">{shift.closedReason}</p>
            </div>
          </div>
        )}

        {shift.status === "ABANDONED" && !shift.closedReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">Abandoned shift</h3>
              <p className="text-sm text-red-800 mt-0.5">Auto-closed after a long period of inactivity. The drawer was never counted.</p>
            </div>
          </div>
        )}

        {/* ── Headline numbers ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-b border-slate-100 pb-8">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Net sales</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{formatPKR(totalSales)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{shift._count?.orders ?? 0} orders</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Opening float</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{formatPKR(openFloat)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Closing cash</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{shift.closedAt ? formatPKR(closingCash) : "—"}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{shift.closedAt ? "counted by cashier" : "not counted yet"}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Variance</p>
            <p className={`text-2xl font-semibold tabular-nums ${
              isOpen ? "text-slate-300" : variance === 0 ? "text-slate-900" : variance > 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {isOpen ? "—" : formatVariance(variance)}
            </p>
            {!isOpen && variance !== 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">{variance > 0 ? "drawer over" : "drawer short"}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-10">

            <Section title="Cash reconciliation">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div className="p-5 bg-slate-50/60 sm:border-r border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Expected</p>
                    <Row label="Opening float" value={formatPKR(openFloat)} />
                    <Row label="Cash sales" value={formatPKR(totalCash)} />
                    {cashIn > 0 && <Row label="Cash in" value={`+${formatPKR(cashIn)}`} />}
                    {cashOut > 0 && <Row label="Cash out" value={`−${formatPKR(cashOut)}`} tone="text-red-600" />}
                    <Row label="Expected in drawer" value={formatPKR(expectedCash)} strong />
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Counted</p>
                    <Row label="Cashier count" value={shift.closedAt ? formatPKR(closingCash) : "—"} />
                    {denominations.length > 0 && <Row label="Denomination total" value={formatPKR(countedFromDenominations)} />}
                    <Row
                      label="Variance"
                      value={isOpen ? "—" : formatVariance(variance)}
                      strong
                      tone={isOpen ? "text-slate-400" : variance === 0 ? "text-slate-500" : variance > 0 ? "text-emerald-600" : "text-red-600"}
                    />

                    {denominations.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Denominations</p>
                        <div className="space-y-1">
                          {denominations.map((d: any) => (
                            <div key={d.id} className="flex justify-between text-xs text-slate-500 tabular-nums">
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
            </Section>

            {cashEntries.length > 0 && (
              <Section title="Cash movements">
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {cashEntries.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {e.type === "CASH_IN" ? "Cash in" : "Cash out"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{e.reason || "No reason given"}</p>
                      </div>
                      <div className="text-right shrink-0 pl-4">
                        <p className={`text-sm font-semibold tabular-nums ${e.type === "CASH_OUT" ? "text-red-600" : "text-slate-800"}`}>
                          {e.type === "CASH_OUT" ? "−" : "+"}{formatPKR(e.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400 tabular-nums">{fmtTime(e.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Time on shift">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total", value: fmtDuration(shiftMs) },
                  { label: "Active", value: fmtDuration(activeMs) },
                  { label: "On break", value: fmtDuration(totalBreakMs), hint: `${breaks.length} break${breaks.length === 1 ? "" : "s"}` },
                ].map(s => (
                  <div key={s.label} className="border border-slate-200 rounded-xl p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">{s.label}</p>
                    <p className="text-lg font-semibold text-slate-900 tabular-nums">{s.value}</p>
                    {s.hint && <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>}
                  </div>
                ))}
              </div>

              {breaks.length > 0 && (
                <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/60 border-b border-slate-200">
                      <tr>
                        {["Started", "Ended", "Duration", "Reason"].map(h => (
                          <th key={h} className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {breaks.map((b: any) => (
                        <tr key={b.id}>
                          <td className="px-5 py-2.5 text-xs text-slate-600 tabular-nums">{fmtTime(b.startedAt)}</td>
                          <td className="px-5 py-2.5 text-xs tabular-nums">
                            {b.endedAt ? <span className="text-slate-600">{fmtTime(b.endedAt)}</span> : <span className="text-amber-600 font-medium">Still on break</span>}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-slate-800 font-medium tabular-nums">
                            {b.durationMinutes != null
                              ? `${b.durationMinutes}m`
                              : fmtDuration(Date.now() - new Date(b.startedAt).getTime())}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-slate-500">{b.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Payment mix">
              <div className="border border-slate-200 rounded-xl p-5">
                {isOrdersLoading ? <div className="h-10 skeleton-shimmer rounded" /> : <PaymentBreakdown orders={orders} />}
              </div>
            </Section>

            {waiterStats.length > 0 && (
              <Section title="Server performance">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/60 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Server</th>
                        <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Orders</th>
                        <th className="px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...waiterStats].sort((a, b) => (b._sum.netAmount ?? 0) - (a._sum.netAmount ?? 0)).map((w: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="px-5 py-2.5 font-medium text-slate-800">{w.assignedWaiterName || "Unassigned"}</td>
                          <td className="px-5 py-2.5 text-slate-500 tabular-nums">{w._count.id}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">{formatPKR(w._sum.netAmount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            <Section
              title={`Orders${ordersData?.total ? ` (${ordersData.total})` : ""}`}
              action={ordersData && ordersData.pages > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                    disabled={ordersPage <= 1}
                    className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    aria-label="Previous orders page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-400 px-1 tabular-nums">{ordersPage} / {ordersData.pages}</span>
                  <button
                    onClick={() => setOrdersPage(p => p + 1)}
                    disabled={ordersPage >= ordersData.pages}
                    className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    aria-label="Next orders page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : undefined}
            >
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/60 border-b border-slate-200">
                    <tr>
                      {["Order", "Time", "Table", "Type", "Items", "Payment", "Discount", "Net"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                            i >= 6 ? "text-right" : ""
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isOrdersLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-2.5"><div className="h-3 skeleton-shimmer rounded w-12" /></td>
                          ))}
                        </tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No orders were rung up on this shift.</td></tr>
                    ) : (
                      orders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">#{o.orderNumber}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums whitespace-nowrap">{fmtTime(o.createdAt)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{o.table?.label ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{String(o.type ?? "").replace(/_/g, " ")}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums">{o._count?.items ?? 0}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                            {(o.payments ?? []).map((p: any) => p.method).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 text-right tabular-nums whitespace-nowrap">
                            {o.discountAmount ? formatPKR(o.discountAmount) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums whitespace-nowrap">
                            {formatPKR(o.netAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            {shift.notes && (
              <Section title="Shift notes">
                <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {shift.notes}
                </div>
              </Section>
            )}
          </div>

          {/* ── Timeline ── */}
          <div>
            <Section title={`Activity${shift._count?.activities ? ` (${shift._count.activities})` : ""}`}>
              <div className="border border-slate-200 rounded-xl bg-white p-5">
                {isActivityLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-10 skeleton-shimmer rounded-md" />)}
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No activity recorded.</p>
                ) : (
                  // Bounded and internally scrollable — a busy shift can run to
                  // hundreds of entries once "Load more" has been clicked a few
                  // times, and an unbounded list here made the card grow taller
                  // than the entire main content column, dragging the whole
                  // page down with it. The sidebar now stays a fixed-height
                  // panel regardless of how much history is loaded into it.
                  <div className="relative pl-3 border-l border-slate-100 space-y-5 max-h-[640px] overflow-y-auto pr-1">
                    {activities.map((event: any, i: number) => {
                      const style = EVENT_STYLE[event.type] ?? { label: event.type, dot: "bg-slate-300" };
                      return (
                        <div key={event.id ?? i} className="relative">
                          <div className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ${style.dot} border-[3px] border-white box-content`} />
                          <div className="pl-4">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{style.label}</span>
                              <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{fmtTime(event.time)}</span>
                            </div>
                            <p className="text-[13px] text-slate-700 leading-snug mt-0.5">{event.description}</p>
                            {(event.amount > 0 || event.performedBy) && (
                              <div className="flex items-center gap-2 mt-1">
                                {event.amount > 0 && (
                                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                                    {formatPKR(event.amount)}
                                  </span>
                                )}
                                {event.performedBy && (
                                  <span className="text-[11px] text-slate-400">by {event.performedBy}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasNextPage && (
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="w-full mt-5 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more"}
                    {!isFetchingNextPage && <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </Section>
          </div>

        </div>
      </div>
    </div>
  );
}
