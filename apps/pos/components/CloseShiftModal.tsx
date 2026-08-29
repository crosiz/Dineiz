'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPosShift, getToken, resolveActiveShiftId } from '@/lib/pos-session';
import { downloadShiftReport, printShiftReport } from '@/lib/shift-report';
import {
  getUnsyncedSummary, getSyncCategoryProgress, markShiftPendingSync, kickOutbox,
  type SyncCategoryProgress,
} from '@/lib/core/outbox';
import { closeShift as emitShiftClosed } from '@/lib/core/commands';
import { AdminPinModal } from '@/components/AdminPinModal';
import { useBrandingStore } from '@/lib/branding-store';
import {
  Clock, X, CheckCircle2, Printer, Download, AlertCircle, Timer, Receipt,
  Banknote, Coffee, TrendingUp, TrendingDown, FileEdit, CheckCheck, Loader2, Check,
  RefreshCw, CloudOff,
} from 'lucide-react';

const DEFAULT_SYNC_TIMEOUT_MS = 45_000; // spec Part 6 — overridable in console settings

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** PKR notes and coins, largest first — the order a cashier counts them in. */
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5];

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

export function CloseShiftModal({ isOpen, onClose }: CloseShiftModalProps) {
  const router = useRouter();
  const branding = useBrandingStore((s) => s.branding);
  const cfg = { ...(branding.pos ?? {}), ...branding };
  const cashCountRequired = cfg.cashCountRequired ?? true;
  const allowCloseWithUnsynced = cfg.allowCloseWithUnsynced ?? true;
  const closeWithUnsyncedRequiresPin = cfg.closeWithUnsyncedRequiresPin ?? true;
  const SYNC_TIMEOUT_MS = Math.max(5, Number(cfg.shiftCloseSyncTimeoutSec ?? 45)) * 1000 || DEFAULT_SYNC_TIMEOUT_MS;
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  // The shift this terminal thinks is open was already closed server-side
  // (the inactivity sweeper auto-closes a long-idle shift). Not an error to
  // retry — there is simply nothing to close. Show a way forward instead of
  // a dead "couldn't load" state.
  const [noOpenShift, setNoOpenShift] = useState(false);

  const [closingCash, setClosingCash] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [countMode, setCountMode] = useState<'total' | 'denominations'>('total');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [reportState, setReportState] = useState<'idle' | 'working' | 'saved' | 'failed'>('idle');
  const [savedFilename, setSavedFilename] = useState('');

  // ── Sync step (spec Part 6) ──────────────────────────────────────────────
  const [syncPhase, setSyncPhase] = useState<'none' | 'syncing' | 'incomplete'>('none');
  const [syncNow, setSyncNow] = useState<SyncCategoryProgress>({ payments: 0, orders: 0, other: 0, total: 0 });
  const [syncElapsed, setSyncElapsed] = useState(0);
  const [showCloseAnywayPin, setShowCloseAnywayPin] = useState(false);
  const syncBaseRef = useRef<SyncCategoryProgress>({ payments: 0, orders: 0, other: 0, total: 0 });
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStartRef = useRef(0);

  const stopSyncTimers = () => {
    if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null; }
    if (syncDeadlineRef.current) { clearTimeout(syncDeadlineRef.current); syncDeadlineRef.current = null; }
  };
  useEffect(() => stopSyncTimers, []);

  // Not read straight from localStorage: the shift the terminal thinks is
  // open can be stale — the inactivity sweeper auto-closes a shift after
  // ~20 hours with no client-side signal, and this screen used to trust
  // getPosShift() blindly, showing (and trying to close) a shift the server
  // had already ended. resolveActiveShiftId checks the server first.
  const [shiftId, setShiftId] = useState<string | null>(() => getPosShift()?.shiftId ?? null);

  // Closing a shift clears the POS session, so the token has to be captured
  // before that happens — the report download that follows still needs it.
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) tokenRef.current = getToken();
  const token = tokenRef.current;

  useEffect(() => {
    if (!isOpen) return;

    const fetchSummary = async () => {
      setIsLoading(true);
      setNoOpenShift(false);
      try {
        const resolvedId = await resolveActiveShiftId(API_URL);
        setShiftId(resolvedId);
        // resolveActiveShiftId already cleared the stale `pos_shift` from
        // localStorage — surface it plainly and route the cashier onward
        // rather than toasting an error into a blank modal.
        if (!resolvedId) {
          setNoOpenShift(true);
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/api/shifts/${resolvedId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch shift summary');
        setSummary(await res.json());
      } catch (err: any) {
        toast.error(err.message || 'Error fetching shift summary');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen, token]);

  // Denomination counting drives the total, so the two can never disagree.
  const denominationTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] || 0), 0),
    [counts],
  );

  useEffect(() => {
    if (countMode === 'denominations') setClosingCash(denominationTotal);
  }, [countMode, denominationTotal]);

  if (!isOpen) return null;

  // Expected cash comes from the server, which already accounts for mid-shift
  // cash in/out. Recomputing it here from float + cash sales is how the POS
  // and the dashboard used to report different variances for the same shift.
  const expectedCash = Number(summary?.expectedCash ?? 0);
  const counted = closingCash === '' ? 0 : Number(closingCash);
  const variance = closingCash === '' ? 0 : counted - expectedCash;

  const formatDuration = (openedAtStr: string) => {
    const ms = Date.now() - new Date(openedAtStr).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const saveReport = async () => {
    if (!shiftId) return;
    setReportState('working');
    try {
      const { filename } = await downloadShiftReport(shiftId, 'pdf', token);
      setSavedFilename(filename);
      setReportState('saved');
    } catch (err: any) {
      setReportState('failed');
      toast.error(err.message || 'Could not generate the shift report');
    }
  };

  // The actual close call. `pendingSync` = there are still-unsynced events; the
  // shift goes to PENDING_SYNC and the terminal keeps shipping in the
  // background (spec Part 6).
  const doClose = async (pendingSync: boolean) => {
    if (!shiftId) return;
    setIsSubmitting(true);
    try {
      const overridePin = localStorage.getItem('shift_override_pin');
      const overrideReason = localStorage.getItem('shift_override_reason');

      const denominations = countMode === 'denominations'
        ? DENOMINATIONS.filter(d => (counts[d] || 0) > 0).map(d => ({ denomination: d, quantity: counts[d] }))
        : [];

      const cat = pendingSync ? await getSyncCategoryProgress() : null;
      const payload: any = {
        closingCash: closingCash === '' ? null : Number(closingCash),
        notes: notes.trim() ? notes : undefined,
        ...(denominations.length > 0 ? { denominations } : {}),
        ...(pendingSync ? { pendingSync: true, pendingSyncCount: cat?.total ?? 0 } : {}),
      };
      if (overridePin && overrideReason) {
        payload.overridePin = overridePin;
        payload.overrideReason = overrideReason;
      }

      // Spec Part 6: "A shift can always be closed. The cashier goes home. The
      // restaurant closes. The software must never prevent this." A failed or
      // unreachable POST therefore must NOT throw — it downgrades to the same
      // pending-sync path an explicit background close takes. Previously any
      // network blip left the cashier stuck in this modal with no way out.
      let closedOnServer = false;
      let serverError: string | null = null;
      try {
        const res = await fetch(`${API_URL}/api/shifts/${shiftId}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          closedOnServer = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          serverError = errData.error || `Server refused the close (${res.status})`;
        }
      } catch {
        serverError = 'offline';
      }

      // A 4xx is the server saying "no" for a real reason (blockers, wrong
      // state) — surface it and let the cashier act. Only a transport failure
      // or a 5xx falls through to closing locally.
      if (!closedOnServer && serverError && serverError !== 'offline' && !/50\d/.test(serverError)) {
        throw new Error(serverError);
      }

      // Local audit: the shift is closed on this terminal now, whatever the
      // sync state.
      emitShiftClosed(shiftId, closingCash === '' ? 0 : Number(closingCash), closingCash === '' ? 0 : Number(closingCash) - expectedCash, notes.trim() || undefined).catch(() => {});

      localStorage.removeItem('shift_override_pin');
      localStorage.removeItem('shift_override_reason');
      stopSyncTimers();

      if (pendingSync || !closedOnServer) {
        // Keep the token/session so the background outbox can finish
        // shipping; hand off to the dedicated screen. When the close POST
        // itself never landed, hand the payload over too so the outbox can
        // replay it — otherwise the server never learns the shift closed and
        // sync-complete has nothing to finalise.
        markShiftPendingSync(shiftId, closedOnServer ? undefined : payload);
        localStorage.removeItem('pos_shift');
        kickOutbox('immediate');
        toast.success(
          closedOnServer
            ? 'Shift closed — finishing sync in the background'
            : 'Shift closed on this terminal — it will reach the server when you’re back online',
        );
        router.replace(`/pos/shift/synced?shiftId=${shiftId}`);
        return;
      }

      localStorage.removeItem('pos_shift');
      localStorage.removeItem('pos_session');
      setSyncPhase('none');
      toast.success('Shift closed');
      setIsSuccess(true);
      void saveReport();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred closing the shift');
      setIsSubmitting(false);
      setSyncPhase('none');
    }
  };

  const beginSyncWait = () => {
    getSyncCategoryProgress().then((c) => {
      syncBaseRef.current = c;
      setSyncNow(c);
    });
    syncStartRef.current = Date.now();
    setSyncElapsed(0);
    setSyncPhase('syncing');
    kickOutbox('immediate');

    syncPollRef.current = setInterval(async () => {
      setSyncElapsed(Math.round((Date.now() - syncStartRef.current) / 1000));
      const summary = await getUnsyncedSummary();
      const c = await getSyncCategoryProgress();
      setSyncNow(c);
      if (summary.count === 0) {
        stopSyncTimers();
        void doClose(false);
      }
    }, 1000);

    syncDeadlineRef.current = setTimeout(() => {
      if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null; }
      setSyncPhase('incomplete');
    }, SYNC_TIMEOUT_MS);
  };

  const handleSubmit = async () => {
    if (closingCash === '' && cashCountRequired) {
      toast.error('Enter the cash you counted in the drawer');
      return;
    }
    const summary = await getUnsyncedSummary();
    if (summary.count === 0) {
      void doClose(false);
    } else {
      beginSyncWait();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-slide-up">

        {syncPhase !== 'none' ? (
          // ── Sync step (spec Part 6) ──────────────────────────────────────
          (() => {
            const base = syncBaseRef.current;
            const done = Math.max(0, base.total - syncNow.total);
            const pct = base.total > 0 ? Math.round((done / base.total) * 100) : 100;
            const rate = syncElapsed > 0 ? done / syncElapsed : 0;
            const etaSec = rate > 0 ? Math.ceil(syncNow.total / rate) : null;
            const row = (label: string, b: number, n: number) => (
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-600 font-medium">{label}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold text-slate-900">{Math.max(0, b - n)} of {b}</span>
                  {n === 0
                    ? <Check size={13} className="text-emerald-600" />
                    : <RefreshCw size={12} className="text-amber-500 animate-spin" style={{ animationDuration: '1.4s' }} />}
                </span>
              </div>
            );
            return (
              <div className="p-6">
                {syncPhase === 'syncing' ? (
                  <>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <RefreshCw size={17} className="animate-spin" style={{ animationDuration: '1.5s' }} />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">Syncing your shift</h2>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                      <div className="h-full bg-[#FF5722] transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium tabular-nums mb-4">{done} of {base.total}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 mb-4">
                      {row('Payments', base.payments, syncNow.payments)}
                      {row('Orders', base.orders, syncNow.orders)}
                      {row('Other', base.other, syncNow.other)}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mb-4 tabular-nums">
                      Elapsed {syncElapsed}s{etaSec !== null && syncNow.total > 0 ? ` · Estimated ${etaSec}s remaining` : ''}
                    </p>
                    {allowCloseWithUnsynced && (
                      <button
                        onClick={() => (closeWithUnsyncedRequiresPin ? setShowCloseAnywayPin(true) : doClose(true))}
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Close in Background
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                        <CloudOff size={17} />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">Sync incomplete</h2>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-1">
                      <strong className="text-slate-900 tabular-nums">{syncNow.total} item{syncNow.total === 1 ? '' : 's'}</strong> could not sync.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-5">
                      Financial data is safe on this device and will sync automatically.
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={beginSyncWait}
                        disabled={isSubmitting}
                        className={`h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 ${allowCloseWithUnsynced ? 'flex-1' : 'w-full'}`}
                      >
                        <RefreshCw size={13} /> Keep Trying
                      </button>
                      {allowCloseWithUnsynced && (
                        <button
                          onClick={() => (closeWithUnsyncedRequiresPin ? setShowCloseAnywayPin(true) : doClose(true))}
                          disabled={isSubmitting}
                          className="flex-1 h-10 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          Close Anyway
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-3">
                      {allowCloseWithUnsynced
                        ? (closeWithUnsyncedRequiresPin ? 'Close Anyway needs a manager PIN and flags this shift for review.' : 'Closing now flags this shift for review; it keeps syncing in the background.')
                        : 'Your administrator requires the queue to clear before this shift can close.'}
                    </p>
                  </>
                )}
              </div>
            );
          })()
        ) : isSuccess ? (
          // ── Closed ────────────────────────────────────────────────────────
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Shift Closed</h2>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 my-5 text-left">
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500 font-medium">Expected in drawer</span>
                <span className="font-bold text-slate-900 tabular-nums">{pkr(expectedCash)}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-500 font-medium">You counted</span>
                <span className="font-bold text-slate-900 tabular-nums">{pkr(counted)}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 mt-1 border-t border-slate-200">
                <span className="font-bold text-slate-900">Variance</span>
                <span className={`font-bold tabular-nums ${
                  Math.round(variance) === 0 ? 'text-emerald-600' : variance > 0 ? 'text-sky-700' : 'text-rose-600'
                }`}>
                  {Math.round(variance) === 0 ? 'Balanced' : `${variance > 0 ? '+' : '−'}${pkr(Math.abs(variance))}`}
                </span>
              </div>
            </div>

            {/* Report status — a real status line, not decoration: the PDF
                starts saving the moment the shift closes. */}
            <div className="w-full mb-5 min-h-[20px] flex items-center justify-center gap-2 text-xs">
              {reportState === 'working' && (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                  <span className="text-slate-500 font-medium">Generating your shift report…</span>
                </>
              )}
              {reportState === 'saved' && (
                <>
                  <CheckCheck size={14} className="text-emerald-600" />
                  <span className="text-slate-600 font-medium truncate max-w-[320px]">Saved {savedFilename}</span>
                </>
              )}
              {reportState === 'failed' && (
                <span className="text-rose-600 font-medium">Report could not be generated — try again below.</span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => shiftId && printShiftReport(shiftId, token).catch(e => toast.error(e.message))}
                className="w-full h-11 bg-[#FF5722] text-white rounded-xl font-semibold text-xs hover:bg-orange-600 transition-colors flex justify-center items-center gap-2 shadow-xs"
              >
                <Printer size={15} />
                Print Report
              </button>
              <button
                onClick={saveReport}
                disabled={reportState === 'working'}
                className="w-full h-11 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-50 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                <Download size={15} />
                {reportState === 'saved' ? 'Download Again' : 'Download PDF'}
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full h-10 mt-1 text-slate-500 font-semibold text-xs hover:text-slate-900 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5722]">
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Close Shift</h2>
                  <p className="text-xs text-slate-500 font-medium">Count the drawer and reconcile</p>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Cancel"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF5722] animate-spin" />
                  <span className="text-xs font-medium">Calculating totals…</span>
                </div>
              ) : noOpenShift ? (
                <div className="text-center py-10 px-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-3">
                    <Clock size={20} />
                  </div>
                  <p className="text-slate-900 font-bold text-sm mb-1">This shift is already closed</p>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-[300px] mx-auto mb-5">
                    It was closed automatically after being left open too long. Everything it recorded is
                    saved. Open a fresh shift to keep serving.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={onClose}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => { onClose(); router.push('/pos/shift/open'); }}
                      className="h-10 px-4 rounded-xl bg-[#FF5722] hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      Open a New Shift
                    </button>
                  </div>
                </div>
              ) : !summary ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-rose-600 font-bold text-xs">Couldn&apos;t load the shift summary.</p>
                  <p className="text-slate-400 text-[11px] mt-1">Check your connection and try reopening this dialog.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">

                  {/* Shift at a glance. Net Sales is paid orders only — the
                      same basis as the drawer — so the two can't look like
                      they disagree. Anything still open is its own line below. */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { Icon: Timer, label: 'Duration', value: formatDuration(summary.openedAt) },
                      { Icon: Receipt, label: 'Orders Paid', value: String(summary.totalOrders) },
                      { Icon: Banknote, label: 'Net Sales', value: pkr(summary.totalSales) },
                      { Icon: Coffee, label: 'Breaks', value: `${summary.breakCount ?? 0} · ${summary.totalBreakMinutes ?? 0}m` },
                    ].map(({ Icon, label, value }) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Icon size={12} />
                          {label}
                        </p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Still-open orders on this shift. Their value is deliberately
                      NOT in Net Sales — nobody has paid for them — so saying so
                      here is what stops the two numbers looking contradictory. */}
                  {(summary.unpaidOrders ?? 0) > 0 && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                      <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-900 leading-relaxed">
                        <strong>{summary.unpaidOrders} order{summary.unpaidOrders === 1 ? '' : 's'} still open</strong>
                        {' '}({pkr(summary.unpaidValue ?? 0)}). Not counted in net sales or the drawer —
                        settle or cancel {summary.unpaidOrders === 1 ? 'it' : 'them'} before closing.
                      </p>
                    </div>
                  )}

                  {/* What the drawer should hold */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-2.5">Expected in Drawer</p>
                    <div className="space-y-1 text-xs text-orange-900/80 font-medium">
                      <div className="flex justify-between"><span>Opening float</span><span className="tabular-nums">{pkr(summary.openingFloat)}</span></div>
                      <div className="flex justify-between"><span>Cash sales</span><span className="tabular-nums">{pkr(summary.totalCash)}</span></div>
                      {summary.cashIn > 0 && <div className="flex justify-between"><span>Cash in</span><span className="tabular-nums">+{pkr(summary.cashIn)}</span></div>}
                      {summary.cashOut > 0 && <div className="flex justify-between"><span>Cash out</span><span className="tabular-nums">−{pkr(summary.cashOut)}</span></div>}
                    </div>
                    <div className="flex justify-between items-baseline pt-2.5 mt-2.5 border-t border-orange-300/60">
                      <span className="text-xs font-bold text-orange-900">Total</span>
                      <span className="text-lg font-bold text-orange-900 tabular-nums">{pkr(expectedCash)}</span>
                    </div>
                  </div>

                  {/* Count */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Cash in Drawer</label>
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {([
                          { key: 'total', label: 'Enter total' },
                          { key: 'denominations', label: 'Count notes' },
                        ] as const).map(m => (
                          <button
                            key={m.key}
                            onClick={() => setCountMode(m.key)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              countMode === m.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {countMode === 'total' ? (
                      <div className="h-14 border-2 border-slate-200 focus-within:border-[#FF5722] rounded-xl bg-white flex items-center px-4 transition-colors">
                        <span className="text-xs font-bold text-[#FF5722] mr-3">PKR</span>
                        <div className="w-px h-5 bg-slate-200" />
                        <input
                          type="number"
                          inputMode="numeric"
                          value={closingCash}
                          onChange={(e) => setClosingCash(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-transparent border-none text-right text-xl font-bold text-slate-900 focus:ring-0 placeholder:text-slate-300 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        {DENOMINATIONS.map((d, i) => (
                          <div key={d} className={`flex items-center gap-3 px-3.5 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                            <span className="w-[60px] text-xs font-bold text-slate-900 tabular-nums">{d.toLocaleString()}</span>
                            <span className="text-slate-300 text-xs">×</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={counts[d] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                                setCounts(c => ({ ...c, [d]: v }));
                              }}
                              placeholder="0"
                              className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900 outline-none focus:border-[#FF5722] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="flex-1 text-right text-xs font-bold text-slate-600 tabular-nums">
                              {(counts[d] || 0) > 0 ? pkr(d * counts[d]) : '—'}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Counted</span>
                          <span className="text-base font-bold text-slate-900 tabular-nums">{pkr(denominationTotal)}</span>
                        </div>
                      </div>
                    )}

                    {/* Variance */}
                    <div className="mt-3 min-h-[22px]">
                      {closingCash !== '' && (
                        <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-bold ${
                          Math.round(variance) === 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : variance > 0
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {Math.round(variance) === 0 ? <Check size={14} /> : variance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          <span>
                            {Math.round(variance) === 0
                              ? 'Drawer balances'
                              : variance > 0
                                ? `Over by ${pkr(Math.abs(variance))}`
                                : `Short by ${pkr(Math.abs(variance))}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-2">
                      <FileEdit size={12} />
                      Notes <span className="text-slate-500 font-medium normal-case">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Explain any variance, refunds or payouts…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs outline-none focus:border-[#FF5722] transition-colors resize-none h-20 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer — nothing to submit when there's no open shift to close */}
            {!noOpenShift && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || isSubmitting || !summary || (cashCountRequired && closingCash === '')}
                  className="w-full h-11 rounded-xl bg-[#FF5722] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={15} />}
                  Close Shift &amp; Save Report
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCloseAnywayPin && (
        <AdminPinModal
          onClose={() => setShowCloseAnywayPin(false)}
          onSuccess={() => {
            setShowCloseAnywayPin(false);
            void doClose(true);
          }}
        />
      )}
    </div>
  );
}
