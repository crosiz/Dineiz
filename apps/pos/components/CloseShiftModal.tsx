'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPosShift, getToken, resolveActiveShiftId } from '@/lib/pos-session';
import { downloadShiftReport, printShiftReport } from '@/lib/shift-report';
import {
  getUnsyncedSummary, getSyncCategoryProgress, markShiftPendingSync, kickOutbox, flushOutbox, isSettledLocally,
  type SyncCategoryProgress, getShiftSyncStatus,
} from '@/lib/core/outbox';
import { closeShift as emitShiftClosed, cancelOrder } from '@/lib/core/commands';
import { isShiftPendingOpen, resolveShiftId } from '@/lib/offline-shift';
import { localShiftSummary } from '@/lib/local-shift-summary';
import { OrderTypeBadge } from '@/components/OrderStatusBadge';
import { AdminPinModal } from '@/components/AdminPinModal';
import { useBrandingStore } from '@/lib/branding-store';
import { formatPKR } from '@/lib/utils';
import {
  Clock, X, CheckCircle2, Printer, Download, AlertCircle, Timer, Receipt,
  Banknote, Coffee, TrendingUp, TrendingDown, FileEdit, CheckCheck, Loader2, Check,
  RefreshCw, CloudOff,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

interface UnpaidOrderRow {
  id: string;
  orderNumber: string;
  netAmount: number;
  status: string;
  tableLabel: string | null;
}

const DEFAULT_SYNC_TIMEOUT_MS = 45_000; // spec Part 6 — overridable in console settings

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}


// An order the server still lists as unpaid but this terminal has settled
// (its payment is in the queue) is not an open order; the sync step before the
// close sends it. Listing it made the cashier hunt for an order that was paid.
function dropLocallySettled(summary: any) {
  if (!Array.isArray(summary?.unpaidOrdersList)) return summary;
  const list = summary.unpaidOrdersList.filter((o: any) => !isSettledLocally(o));
  if (list.length === summary.unpaidOrdersList.length) return summary;
  return {
    ...summary,
    unpaidOrdersList: list,
    unpaidOrders: list.length,
    unpaidValue: list.reduce((sum: number, o: any) => sum + (Number(o.netAmount) || 0), 0),
  };
}

/** PKR notes and coins, largest first — the order a cashier counts them in. */
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5];


export function CloseShiftModal({ isOpen, onClose }: CloseShiftModalProps) {
  const router = useRouter();
  const branding = useBrandingStore((s) => s.branding);
  const cfg = { ...(branding.pos ?? {}), ...branding };
  const cashCountRequired = cfg.cashCountRequired ?? true;
  const allowCloseWithUnsynced = cfg.allowCloseWithUnsynced ?? true;
  const closeWithUnsyncedRequiresPin = cfg.closeWithUnsyncedRequiresPin ?? true;
  const SYNC_TIMEOUT_MS = Math.max(5, Number(cfg.shiftCloseSyncTimeoutSec ?? 45)) * 1000 || DEFAULT_SYNC_TIMEOUT_MS;
  const [isLoading, setIsLoading] = useState(true);
  const [syncProblems, setSyncProblems] = useState(0);
  const [shiftPending, setShiftPending] = useState(0);
  const [loadingNote, setLoadingNote] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const closeInFlight = useRef(false);
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
  // The remaining events aren't broken — the server is unreachable (Redis down /
  // offline). Changes the "Sync incomplete" copy from "N items could not sync"
  // (reads as data loss) to "can't reach the server, will finish on its own",
  // and skips the 45s countdown that's pointless against a dead server.
  const [serverUnreachable, setServerUnreachable] = useState(false);
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

  // Re-run after the cashier settles/cancels an order from the list below,
  // so the warning (and the button it's blocking) clears the moment there's
  // nothing left open — no need to close and reopen this modal.
  const fetchSummary = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setNoOpenShift(false);
    try {
      // The summary is the server's view of this shift. Anything still queued
      // here (a payment taken seconds ago) goes first, or it comes back as an
      // unpaid order.
      const pending = await getUnsyncedSummary();
      const queued = pending.count;
      const reachable = navigator.onLine !== false && !pending.circuitOpen;
      if (queued > 0 && reachable) {
        setLoadingNote(`Sending ${queued} change${queued === 1 ? '' : 's'} to the server…`);
        await flushOutbox(8000);
      }
      setLoadingNote(null);
      const resolvedId = await resolveActiveShiftId(API_URL);
      setShiftId(resolvedId);
      if (resolvedId) {
        const sync = await getShiftSyncStatus(resolvedId);
        setSyncProblems(sync.rejected);
        setShiftPending(sync.pending);
      }
      // resolveActiveShiftId already cleared the stale `pos_shift` from
      // localStorage — surface it plainly and route the cashier onward
      // rather than toasting an error into a blank modal.
      if (!resolvedId) {
        setNoOpenShift(true);
        setIsLoading(false);
        return;
      }

      // No server to ask (offline, or a shift opened offline that it hasn't
      // heard of yet): work the summary out from this terminal's orders so the
      // shift can still be closed. The close is queued and the server
      // recomputes the totals when it arrives.
      let res: Response | null = null;
      if (!isShiftPendingOpen(resolvedId)) {
        try {
          res = await fetch(`${API_URL}/api/shifts/${resolveShiftId(resolvedId)}/summary`, {
            headers: { Authorization: `Bearer ${getToken()}` },
            signal: AbortSignal.timeout(8000),
          });
        } catch {
          res = null;
        }
      }
      if (!res || res.status >= 500) {
        setSummary(await localShiftSummary(resolvedId));
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch shift summary');
      setSummary(dropLocallySettled(await res.json()));
    } catch (err: any) {
      toast.error(err.message || 'Error fetching shift summary');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, token]);

  // Cancelling here goes through the same local-first command Tickets uses
  // — applies instantly, the outbox ships it — so the cashier never has to
  // leave this screen, walk to Tickets, and start the close flow over.
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const cancelUnpaidOrder = async (orderId: string) => {
    setBusyOrderId(orderId);
    try {
      await cancelOrder(orderId);
      toast.success('Order cancelled');
      await fetchSummary(false);
    } catch {
      toast.error('Could not cancel that order — open it from Tickets.');
    } finally {
      setBusyOrderId(null);
    }
  };

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
  // null, not 0 — an uncounted drawer isn't "balanced", it's simply unknown.
  // Pinning this to 0 made the summary read "Counted PKR 0 / Variance:
  // Balanced" whenever cash counting was optional and skipped.
  const variance = closingCash === '' || summary?.local ? null : counted - expectedCash;

  const formatDuration = (openedAtStr: string | null) => {
    if (!openedAtStr) return '—';
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
    if (!shiftId || closeInFlight.current) return;
    closeInFlight.current = true;
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
        // The moment the cashier closed. Replayed later if this POST doesn't
        // land (offline), and the server should record then, not the replay.
        closedAt: new Date().toISOString(),
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
      // A shift opened offline that the server hasn't been told about yet
      // would only 404 here. Close it on the terminal; the outbox registers
      // the open first and then replays this close (lib/offline-shift.ts).
      if (isShiftPendingOpen(shiftId)) {
        serverError = 'offline';
      } else try {
        const res = await fetch(`${API_URL}/api/shifts/${resolveShiftId(shiftId)}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          closedOnServer = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          serverError = res.status >= 500 ? 'offline' : (errData.error || `Server refused the close (${res.status})`);
        }
      } catch {
        serverError = 'offline';
      }

      // A 4xx is the server saying "no" for a real reason (blockers, wrong
      // state) — surface it and let the cashier act. Only a transport failure
      // or a 5xx falls through to closing locally.
      if (!closedOnServer && serverError && serverError !== 'offline') {
        throw new Error(serverError);
      }

      // Local audit: the shift is closed on this terminal now, whatever the
      // sync state.
      await emitShiftClosed(shiftId, closingCash === '' ? 0 : Number(closingCash), closingCash === '' ? 0 : Number(closingCash) - expectedCash, notes.trim() || undefined);

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
    } catch (err: any) {
      toast.error(err.message || 'An error occurred closing the shift');
      closeInFlight.current = false;
      setIsSubmitting(false);
      setSyncPhase('none');
    }
  };

  const beginSyncWait = () => {
    setServerUnreachable(false);
    getSyncCategoryProgress().then((c) => {
      syncBaseRef.current = c;
      setSyncNow(c);
    });
    syncStartRef.current = Date.now();
    setSyncElapsed(0);
    setSyncPhase('syncing');
    kickOutbox('immediate');

    syncPollRef.current = setInterval(async () => {
      const elapsed = Math.round((Date.now() - syncStartRef.current) / 1000);
      setSyncElapsed(elapsed);
      const summary = await getUnsyncedSummary();
      const c = await getSyncCategoryProgress();
      setSyncNow(c);
      const shiftStatus = shiftId ? await getShiftSyncStatus(shiftId) : null;
      if (shiftStatus?.rejected) { stopSyncTimers(); setSyncProblems(shiftStatus.rejected); setSyncPhase('none'); return; }
      if (shiftStatus?.total === 0) {
        stopSyncTimers();
        void doClose(false);
        return;
      }
      // Server is unreachable (circuit breaker open) and no progress has been
      // made — don't make the cashier watch a 45s bar tick against a dead
      // connection. Bail to the "incomplete" step early with the right copy.
      if ((summary.circuitOpen || summary.stalled) && elapsed >= 6) {
        setServerUnreachable(true);
        stopSyncTimers();
        setSyncPhase('incomplete');
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
    if (!shiftId || isSubmitting) return;
    const shiftStatus = await getShiftSyncStatus(shiftId);
    if (shiftStatus.rejected) {
      setSyncProblems(shiftStatus.rejected);
      toast.error('A saved payment or cash movement needs review. Do not record it again.');
      return;
    }
    const summary = await getUnsyncedSummary();
    if (shiftStatus.total === 0) {
      void doClose(false);
    } else if (summary.circuitOpen || summary.stalled) {
      // Server already known-unreachable — go straight to the close-anyway
      // step, no countdown.
      setServerUnreachable(true);
      const c = await getSyncCategoryProgress();
      syncBaseRef.current = c;
      setSyncNow(c);
      setSyncPhase('incomplete');
    } else {
      beginSyncWait();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // One frame for all four states (syncing, sync incomplete, closed, count),
  // on the same shell and type scale as components/ui/Dialog.tsx. It used to
  // be 140-odd raw palette classes (slate/amber/orange/emerald/sky/rose), an
  // orange "Expected in drawer" slab, 10px uppercase labels and 11px buttons.

  const frameHeader = (
    Icon: typeof Clock,
    tone: string,
    title: string,
    description?: React.ReactNode,
    closable = false,
  ) => (
    <header className="px-6 pt-5 pb-4 flex items-start gap-3.5 shrink-0">
      <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-[17px] font-semibold text-ink leading-snug">{title}</h2>
        {description && <div className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{description}</div>}
      </div>
      {closable && (
        <button
          onClick={onClose}
          aria-label="Cancel"
          className="-mr-2 -mt-1 w-9 h-9 grid place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink shrink-0"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      )}
    </header>
  );

  const btn = {
    primary: 'h-11 px-4 rounded-xl bg-brand text-on-brand text-[14px] font-semibold hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2',
    ink: 'h-11 px-4 rounded-xl bg-ink text-white text-[14px] font-semibold hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2',
    secondary: 'h-11 px-4 rounded-xl bg-surface border border-line-strong text-ink text-[14px] font-semibold hover:bg-sunken disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2',
  };

  const varianceTone = variance === null
    ? 'text-ink-3'
    : Math.round(variance) === 0 ? 'text-ok' : variance > 0 ? 'text-info' : 'text-danger';
  const varianceText = variance === null
    ? 'Not counted'
    : Math.round(variance) === 0 ? 'Balanced' : `${variance > 0 ? 'Over' : 'Short'} ${formatPKR(Math.abs(variance))}`;

  const countMissing = cashCountRequired && closingCash === '';

  return (
    <>
      <Modal isOpen={isOpen} onClose={isSubmitting || syncPhase === 'syncing' ? undefined : onClose} label="Close shift" className="max-w-[520px]">
        {syncPhase !== 'none' ? (
          // ── Sync step (spec Part 6) ──────────────────────────────────────
          (() => {
            const base = syncBaseRef.current;
            const done = Math.max(0, base.total - syncNow.total);
            const pct = base.total > 0 ? Math.round((done / base.total) * 100) : 100;
            const rate = syncElapsed > 0 ? done / syncElapsed : 0;
            const etaSec = rate > 0 ? Math.ceil(syncNow.total / rate) : null;
            const row = (label: string, b: number, n: number) => (
              <div className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-ink-2">{label}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold text-ink">{Math.max(0, b - n)} of {b}</span>
                  {n === 0
                    ? <Check className="w-4 h-4 text-ok" />
                    : <RefreshCw className="w-3.5 h-3.5 text-ink-3 animate-spin" style={{ animationDuration: '1.4s' }} />}
                </span>
              </div>
            );

            if (syncPhase === 'syncing') {
              return (
                <>
                  {frameHeader(RefreshCw, 'bg-info/10 text-info', 'Sending your shift to the server', 'Every order and payment goes through before the shift closes.')}
                  <div className="px-6 pb-5">
                    <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                      <div className="h-full bg-brand transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-[12.5px] text-ink-3 tabular-nums">
                      {done} of {base.total} sent · {syncElapsed}s{etaSec !== null && syncNow.total > 0 ? ` · about ${etaSec}s left` : ''}
                    </p>
                    <div className="mt-4 px-4 rounded-xl border border-line divide-y divide-line">
                      {row('Payments', base.payments, syncNow.payments)}
                      {row('Orders', base.orders, syncNow.orders)}
                      {row('Other', base.other, syncNow.other)}
                    </div>
                  </div>
                  {allowCloseWithUnsynced && (
                    <footer className="px-6 py-4 border-t border-line">
                      <button
                        onClick={() => (closeWithUnsyncedRequiresPin ? setShowCloseAnywayPin(true) : doClose(true))}
                        disabled={isSubmitting}
                        className={`${btn.secondary} w-full`}
                      >
                        Close now, finish sending in the background
                      </button>
                    </footer>
                  )}
                </>
              );
            }

            return (
              <>
                {frameHeader(
                  CloudOff,
                  serverUnreachable ? 'bg-warn/15 text-warn' : 'bg-danger/10 text-danger',
                  serverUnreachable ? 'Can’t reach the server' : 'Some changes didn’t send',
                  serverUnreachable ? (
                    <>
                      <strong className="text-ink font-semibold tabular-nums">{syncNow.total} change{syncNow.total === 1 ? '' : 's'}</strong>{' '}
                      {syncNow.total === 1 ? 'is' : 'are'} saved on this terminal and will send by themselves when the connection is back.
                    </>
                  ) : (
                    <>
                      <strong className="text-ink font-semibold tabular-nums">{syncNow.total} item{syncNow.total === 1 ? '' : 's'}</strong> could not send.
                      {' '}They’re safe on this terminal and keep retrying.
                    </>
                  ),
                )}
                <div className="px-6 pb-5">
                  <p className="text-[12.5px] text-ink-3 leading-relaxed">
                    {!allowCloseWithUnsynced
                      ? 'Your administrator requires everything to send before a shift can close.'
                      : closeWithUnsyncedRequiresPin
                        ? 'Closing now needs a manager PIN. The shift is flagged for review and finishes sending on its own.'
                        : 'Closing now flags the shift for review; it finishes sending on its own.'}
                  </p>
                </div>
                <footer className="px-6 py-4 border-t border-line flex gap-2.5">
                  <button onClick={beginSyncWait} disabled={isSubmitting} className={`${btn.secondary} flex-1`}>
                    <RefreshCw className="w-4 h-4" /> Try again
                  </button>
                  {allowCloseWithUnsynced && (
                    <button
                      onClick={() => (closeWithUnsyncedRequiresPin ? setShowCloseAnywayPin(true) : doClose(true))}
                      disabled={isSubmitting}
                      className={`${btn.ink} flex-1`}
                    >
                      Close anyway
                    </button>
                  )}
                </footer>
              </>
            );
          })()
        ) : isSuccess ? (
          // ── Closed ────────────────────────────────────────────────────────
          <>
            <div className="px-6 pt-7 pb-2 flex flex-col items-center text-center">
              <span className="w-14 h-14 rounded-full bg-ok/10 text-ok grid place-items-center mb-3">
                <CheckCircle2 className="w-7 h-7" strokeWidth={2.25} />
              </span>
              <h2 className="text-[18px] font-semibold text-ink">Shift closed</h2>
              <p className="mt-1 text-[13.5px] text-ink-3">Thanks — you’re all done for this shift.</p>
            </div>

            <div className="px-6 py-4">
              <dl className="rounded-xl border border-line divide-y divide-line text-[13.5px]">
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-ink-3">Expected in drawer</dt>
                  <dd className="font-semibold text-ink tabular-nums">{formatPKR(expectedCash)}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-ink-3">You counted</dt>
                  <dd className="font-semibold text-ink tabular-nums">{variance === null ? '—' : formatPKR(counted)}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="font-semibold text-ink">Difference</dt>
                  <dd className={`font-semibold tabular-nums ${varianceTone}`}>{varianceText}</dd>
                </div>
              </dl>

              <p className="mt-3 min-h-5 flex items-center justify-center gap-2 text-[12.5px]">
                {reportState === 'working' && (<><Loader2 className="w-3.5 h-3.5 animate-spin text-ink-3" /><span className="text-ink-3">Generating the shift report…</span></>)}
                {reportState === 'saved' && (<><CheckCheck className="w-3.5 h-3.5 text-ok" /><span className="text-ink-2 truncate max-w-[360px]">Saved {savedFilename}</span></>)}
                {reportState === 'failed' && <span className="text-danger">The report couldn’t be generated. Try again below.</span>}
              </p>
            </div>

            <footer className="px-6 py-4 border-t border-line flex flex-col gap-2">
              <div className="flex gap-2.5">
                <button onClick={saveReport} disabled={reportState === 'working'} className={`${btn.secondary} flex-1`}>
                  {reportState === 'saved' ? <Download className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                  {reportState === 'saved' ? 'Download again' : reportState === 'failed' ? 'Try again' : 'Save report'}
                </button>
                <button
                  onClick={() => shiftId && printShiftReport(shiftId, token).catch(e => toast.error(e.message))}
                  className={`${btn.secondary} flex-1`}
                >
                  <Printer className="w-4 h-4" /> Print report
                </button>
              </div>
              <button onClick={() => router.push('/login')} className={`${btn.primary} w-full`}>
                Done
              </button>
            </footer>
          </>
        ) : (
          // ── Count and close ──────────────────────────────────────────────
          <>
            {frameHeader(Clock, 'bg-sunken text-ink-2', 'Close shift', 'Count the cash in the drawer, then close.', true)}

            <div className="px-6 pb-5 overflow-y-auto min-h-0 flex-1">
              {isLoading ? (
                <div className="py-14 flex flex-col items-center gap-3 text-ink-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-[13px]">{loadingNote ?? 'Working out the totals…'}</span>
                </div>
              ) : noOpenShift ? (
                <div className="py-8 text-center">
                  <p className="text-[15px] font-semibold text-ink">This shift is already closed</p>
                  <p className="mt-1 mx-auto max-w-[320px] text-[13.5px] text-ink-3 leading-relaxed">
                    It closed automatically after being left open too long. Everything it recorded is saved.
                  </p>
                </div>
              ) : !summary ? (
                <div className="py-10 text-center">
                  <span className="w-11 h-11 rounded-xl bg-danger/10 text-danger grid place-items-center mx-auto mb-3">
                    <AlertCircle className="w-5 h-5" />
                  </span>
                  <p className="text-[14px] font-semibold text-ink">Couldn’t load this shift’s totals</p>
                  <p className="mt-1 text-[13px] text-ink-3">Close this and try again.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {(syncProblems > 0 || shiftPending > 0) && <div role="status" className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
                    <p className="font-semibold">{syncProblems ? 'Saved changes need review' : 'Payments and orders are waiting to sync'}</p>
                    <p className="mt-1 text-ink-2">Do not collect a payment or record a cash movement twice. Your local records have been kept.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="min-h-11 px-3 rounded-lg border border-line bg-surface font-semibold" onClick={() => fetchSummary()}>Sync & recheck</button>
                      {syncProblems > 0 && <button className="min-h-11 px-3 font-semibold text-brand" onClick={() => { onClose(); router.push('/pos/settings?section=sync'); }}>Review saved changes</button>}
                    </div>
                  </div>}
                  {summary.local && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-2">
                      <CloudOff className="w-4 h-4 mt-0.5 shrink-0 text-ink-3" />
                      <span>No connection, so these figures are from this terminal only. You can still close; the server rechecks them when it syncs.</span>
                    </div>
                  )}

                  {/* The shift at a glance. Sales are paid orders only — the
                      same basis as the drawer — so the two never disagree. */}
                  <dl className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-line divide-x divide-line overflow-hidden [&>div:nth-child(3)]:border-l-0 sm:[&>div:nth-child(3)]:border-l">
                    {[
                      ['On shift', formatDuration(summary.openedAt)],
                      ['Orders paid', String(summary.totalOrders ?? 0)],
                      ['Sales', formatPKR(summary.totalSales ?? 0)],
                      ['Breaks', `${summary.breakCount ?? 0} · ${summary.totalBreakMinutes ?? 0}m`],
                    ].map(([label, value]) => (
                      <div key={label} className="px-3.5 py-3 min-w-0">
                        <dt className="text-[12px] text-ink-3 truncate">{label}</dt>
                        <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular-nums truncate">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* Still open on this shift: not in sales or the drawer until paid. */}
                  {(summary.unpaidOrders ?? 0) > 0 && (
                    <section className="rounded-xl border border-warn/40 bg-warn/5">
                      <p className="px-4 pt-3 pb-2 text-[13px] text-ink-2 leading-relaxed">
                        <strong className="font-semibold text-ink">
                          {summary.unpaidOrders} order{summary.unpaidOrders === 1 ? '' : 's'} still open
                        </strong>{' '}
                        ({formatPKR(summary.unpaidValue ?? 0)}). Review these orders before closing. If payment was already taken, check Sync & Data; do not collect it again.
                      </p>
                      {Array.isArray(summary.unpaidOrdersList) && summary.unpaidOrdersList.length > 0 && (
                        <ul className="mx-2 mb-2 rounded-lg border border-line bg-surface divide-y divide-line">
                          {(summary.unpaidOrdersList as UnpaidOrderRow[]).map((o) => (
                            <li key={o.id} className="px-3 py-2.5 flex flex-wrap items-center gap-3">
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <span className="text-[13.5px] font-semibold text-ink tabular-nums whitespace-nowrap">#{o.orderNumber}</span>
                                <OrderTypeBadge type={o.tableLabel ? 'DINE_IN' : 'TAKEAWAY'} tableLabel={o.tableLabel} size="sm" />
                              </div>
                              <span className="text-[13px] text-ink-2 tabular-nums">{formatPKR(o.netAmount)}</span>
                              <button
                                onClick={() => { onClose(); router.push(`/pos/order?orderId=${encodeURIComponent(o.id)}`); }}
                                className="min-h-11 px-3 rounded-lg bg-brand text-on-brand text-[12.5px] font-semibold hover:bg-brand-strong"
                              >
                                Review order
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

                  {/* What the drawer should hold. */}
                  <section>
                    <h3 className="text-[13px] font-semibold text-ink-2 mb-2">Expected in the drawer</h3>
                    <dl className="rounded-xl border border-line divide-y divide-line text-[13.5px]">
                      <div className="flex justify-between px-4 py-2.5"><dt className="text-ink-3">Opening float</dt><dd className="text-ink-2 tabular-nums">{formatPKR(summary.openingFloat)}</dd></div>
                      <div className="flex justify-between px-4 py-2.5"><dt className="text-ink-3">Cash sales</dt><dd className="text-ink-2 tabular-nums">{formatPKR(summary.totalCash)}</dd></div>
                      {summary.cashIn > 0 && <div className="flex justify-between px-4 py-2.5"><dt className="text-ink-3">Cash in</dt><dd className="text-ink-2 tabular-nums">+ {formatPKR(summary.cashIn)}</dd></div>}
                      {summary.cashOut > 0 && <div className="flex justify-between px-4 py-2.5"><dt className="text-ink-3">Cash out</dt><dd className="text-ink-2 tabular-nums">− {formatPKR(summary.cashOut)}</dd></div>}
                      <div className="flex justify-between items-baseline px-4 py-3 bg-sunken/60">
                        <dt className="font-semibold text-ink">Expected</dt>
                        <dd className="text-[17px] font-bold text-ink tabular-nums">{formatPKR(expectedCash)}</dd>
                      </div>
                    </dl>
                  </section>

                  {/* The count. */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[13px] font-semibold text-ink-2">Cash in the drawer</h3>
                      <div className="inline-flex p-0.5 rounded-lg bg-sunken border border-line">
                        {([
                          { key: 'total', label: 'Total' },
                          { key: 'denominations', label: 'By note' },
                        ] as const).map((m) => (
                          <button
                            key={m.key}
                            onClick={() => setCountMode(m.key)}
                            className={`h-7 px-3 rounded-md text-[12.5px] font-semibold transition-colors ${
                              countMode === m.key ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-ink-3 hover:text-ink'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {countMode === 'total' ? (
                      <label className="h-14 px-4 flex items-center gap-3 rounded-xl border border-line-strong focus-within:border-ink bg-surface transition-colors">
                        <span className="text-[13px] font-semibold text-ink-3">PKR</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={closingCash === '' ? '' : Number(closingCash).toLocaleString('en-US')}
                          onChange={(e) => {
                            const d = e.target.value.replace(/[^\d]/g, '').slice(0, 9);
                            setClosingCash(d === '' ? '' : Number(d));
                          }}
                          className="w-full bg-transparent border-0 outline-none focus:shadow-none text-right text-[22px] font-bold text-ink tabular-nums placeholder:text-ink-4"
                          placeholder="0"
                                                  />
                      </label>
                    ) : (
                      <div className="rounded-xl border border-line divide-y divide-line overflow-hidden">
                        {DENOMINATIONS.map((d) => (
                          <div key={d} className="px-4 py-2 flex items-center gap-3">
                            <span className="w-16 text-[13.5px] font-semibold text-ink tabular-nums">{d.toLocaleString('en-US')}</span>
                            <span className="text-ink-4 text-[13px]">×</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={counts[d] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                                setCounts((c) => ({ ...c, [d]: v }));
                              }}
                              placeholder="0"
                              className="w-16 h-9 rounded-lg border border-line-strong text-center text-[15px] font-semibold text-ink outline-none focus:border-ink focus:shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="flex-1 text-right text-[13px] text-ink-2 tabular-nums">
                              {(counts[d] || 0) > 0 ? formatPKR(d * counts[d]) : '—'}
                            </span>
                          </div>
                        ))}
                        <div className="px-4 py-3 flex items-baseline justify-between bg-sunken/60">
                          <span className="font-semibold text-ink text-[13.5px]">Counted</span>
                          <span className="text-[17px] font-bold text-ink tabular-nums">{formatPKR(denominationTotal)}</span>
                        </div>
                      </div>
                    )}

                    {closingCash !== '' && variance !== null && (
                      <p className={`mt-2.5 flex items-center gap-2 text-[13.5px] font-semibold ${varianceTone}`}>
                        {Math.round(variance) === 0 ? <Check className="w-4 h-4" /> : variance > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {Math.round(variance) === 0
                          ? 'The drawer balances'
                          : `${variance > 0 ? 'Over' : 'Short'} by ${formatPKR(Math.abs(variance))}`}
                      </p>
                    )}
                  </section>

                  <section>
                    <label className="block text-[13px] font-semibold text-ink-2 mb-2" htmlFor="close-notes">
                      Notes <span className="font-normal text-ink-4">(optional)</span>
                    </label>
                    <textarea
                      id="close-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Explain any difference, refunds or payouts"
                      className="w-full h-20 rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 outline-none focus:border-ink focus:shadow-none resize-none"
                    />
                  </section>
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-line flex gap-2.5 shrink-0">
              {noOpenShift ? (
                <>
                  <button onClick={onClose} className={`${btn.secondary} flex-1`}>Close</button>
                  <button onClick={() => { onClose(); router.push('/pos/shift/open'); }} className={`${btn.primary} flex-1`}>Open a new shift</button>
                </>
              ) : (
                <>
                  <button onClick={onClose} className={`${btn.secondary} flex-1`}>Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || isSubmitting || !summary || countMissing || syncProblems > 0}
                    className={`${btn.primary} flex-[1.4]`}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {countMissing ? 'Enter the cash counted' : 'Close shift'}
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </Modal>

      {showCloseAnywayPin && (
        <AdminPinModal
          onClose={() => setShowCloseAnywayPin(false)}
          onSuccess={() => {
            setShowCloseAnywayPin(false);
            void doClose(true);
          }}
        />
      )}
    </>
  );
}
