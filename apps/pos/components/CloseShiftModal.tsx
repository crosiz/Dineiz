'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPosShift, getToken } from '@/lib/pos-session';
import { downloadShiftReport, printShiftReport } from '@/lib/shift-report';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const [closingCash, setClosingCash] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [countMode, setCountMode] = useState<'total' | 'denominations'>('total');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [reportState, setReportState] = useState<'idle' | 'working' | 'saved' | 'failed'>('idle');
  const [savedFilename, setSavedFilename] = useState('');

  const shiftObj = getPosShift();
  const shiftId = shiftObj?.shiftId;

  // Closing a shift clears the POS session, so the token has to be captured
  // before that happens — the report download that follows still needs it.
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) tokenRef.current = getToken();
  const token = tokenRef.current;

  useEffect(() => {
    if (!isOpen || !shiftId) return;

    const fetchSummary = async () => {
      try {
        const res = await fetch(`${API_URL}/api/shifts/${shiftId}/summary`, {
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
  }, [isOpen, shiftId, token]);

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

  const handleSubmit = async () => {
    if (closingCash === '') {
      toast.error('Enter the cash you counted in the drawer');
      return;
    }

    setIsSubmitting(true);
    try {
      const overridePin = localStorage.getItem('shift_override_pin');
      const overrideReason = localStorage.getItem('shift_override_reason');

      const denominations = countMode === 'denominations'
        ? DENOMINATIONS.filter(d => (counts[d] || 0) > 0).map(d => ({ denomination: d, quantity: counts[d] }))
        : [];

      const payload: any = {
        closingCash: Number(closingCash),
        notes: notes.trim() ? notes : undefined,
        ...(denominations.length > 0 ? { denominations } : {}),
      };

      if (overridePin && overrideReason) {
        payload.overridePin = overridePin;
        payload.overrideReason = overrideReason;
      }

      const res = await fetch(`${API_URL}/api/shifts/${shiftId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to close shift');
      }

      localStorage.removeItem('shift_override_pin');
      localStorage.removeItem('shift_override_reason');
      localStorage.removeItem('pos_shift');
      localStorage.removeItem('pos_session');

      toast.success('Shift closed');
      setIsSuccess(true);
      // The end-of-shift report saves itself — a cashier should not have to
      // remember to click anything to end up with a record of their shift.
      void saveReport();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred closing the shift');
      setIsSubmitting(false);
    }
  };

  // ── Success ─────────────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in font-body-md text-[#0F172A]">
        <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-[#E2E8F0] animate-slide-up">
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <h2 className="text-[20px] font-bold text-[#0F172A] clash-display tracking-wide mb-1.5">Shift closed</h2>

            <div className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px] p-4 my-5 text-left">
              <div className="flex justify-between text-[13px] py-1">
                <span className="text-[#64748B] font-medium">Expected in drawer</span>
                <span className="font-bold">{pkr(expectedCash)}</span>
              </div>
              <div className="flex justify-between text-[13px] py-1">
                <span className="text-[#64748B] font-medium">You counted</span>
                <span className="font-bold">{pkr(counted)}</span>
              </div>
              <div className="flex justify-between text-[13px] pt-2 mt-1 border-t border-[#E2E8F0]">
                <span className="font-bold">Variance</span>
                <span className={`font-bold ${
                  Math.round(variance) === 0 ? 'text-emerald-600' : variance > 0 ? 'text-sky-700' : 'text-rose-600'
                }`}>
                  {Math.round(variance) === 0 ? 'Balanced' : `${variance > 0 ? '+' : '−'}${pkr(Math.abs(variance))}`}
                </span>
              </div>
            </div>

            {/* Report status — this is a real status line, not a decorative one:
                the PDF starts saving the moment the shift closes. */}
            <div className="w-full mb-5 min-h-[22px] flex items-center justify-center gap-2 text-[13px]">
              {reportState === 'working' && (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px] text-[#64748B]">progress_activity</span>
                  <span className="text-[#64748B] font-medium">Generating your shift report…</span>
                </>
              )}
              {reportState === 'saved' && (
                <>
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">download_done</span>
                  <span className="text-[#475569] font-medium truncate max-w-[320px]">Saved {savedFilename}</span>
                </>
              )}
              {reportState === 'failed' && (
                <span className="text-rose-600 font-medium">Report could not be generated — try again below.</span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => shiftId && printShiftReport(shiftId, token).catch(e => toast.error(e.message))}
                className="w-full py-3 bg-[var(--pos-primary,#F59E0B)] text-white rounded-xl font-bold hover:brightness-105 transition-all flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">print</span>
                Print report
              </button>
              <button
                onClick={saveReport}
                disabled={reportState === 'working'}
                className="w-full py-3 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl font-bold hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">download</span>
                {reportState === 'saved' ? 'Download again' : 'Download PDF'}
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 mt-1 text-[#64748B] font-bold hover:text-[#0F172A] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Counting ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in font-body-md text-[#0F172A]">
      <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[92vh] animate-slide-up">

        {/* Header */}
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D97706]">schedule</span>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[#0F172A] clash-display tracking-wide leading-none">Close shift</h2>
              <p className="text-[13px] text-[#64748B] font-medium mt-1">Count the drawer and reconcile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
            aria-label="Cancel"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-[#64748B]">
              <div className="w-12 h-12 rounded-full border-4 border-[#CBD5E1] border-t-[var(--pos-primary,#F59E0B)] animate-spin" />
              <span className="text-[14px] font-medium tracking-wide">Calculating totals…</span>
            </div>
          ) : !summary ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">error</span>
              </div>
              <p className="text-rose-600 font-bold">Couldn&apos;t load the shift summary.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">

              {/* Shift at a glance */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: 'timer', label: 'Duration', value: formatDuration(summary.openedAt) },
                  { icon: 'receipt_long', label: 'Orders', value: String(summary.totalOrders) },
                  { icon: 'payments', label: 'Net sales', value: pkr(summary.totalSales) },
                  { icon: 'free_breakfast', label: 'Breaks', value: `${summary.breakCount ?? 0} · ${summary.totalBreakMinutes ?? 0}m` },
                ].map(s => (
                  <div key={s.label} className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-[14px]">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                      {s.label}
                    </p>
                    <p className="text-[17px] font-bold text-[#0F172A] tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* What the drawer should hold */}
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4">
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-[0.05em] mb-2.5">Expected in drawer</p>
                <div className="space-y-1 text-[13px] text-amber-900/80 font-medium">
                  <div className="flex justify-between"><span>Opening float</span><span className="tabular-nums">{pkr(summary.openingFloat)}</span></div>
                  <div className="flex justify-between"><span>Cash sales</span><span className="tabular-nums">{pkr(summary.totalCash)}</span></div>
                  {summary.cashIn > 0 && <div className="flex justify-between"><span>Cash in</span><span className="tabular-nums">+{pkr(summary.cashIn)}</span></div>}
                  {summary.cashOut > 0 && <div className="flex justify-between"><span>Cash out</span><span className="tabular-nums">−{pkr(summary.cashOut)}</span></div>}
                </div>
                <div className="flex justify-between items-baseline pt-2.5 mt-2.5 border-t border-amber-300/60">
                  <span className="text-[13px] font-bold text-amber-900">Total</span>
                  <span className="text-[22px] font-bold text-amber-900 tabular-nums">{pkr(expectedCash)}</span>
                </div>
              </div>

              {/* Count */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[12px] font-bold text-[#0F172A] uppercase tracking-[0.05em]">
                    Cash in drawer
                  </label>
                  <div className="flex bg-[#F1F5F9] rounded-lg p-0.5">
                    {([
                      { key: 'total', label: 'Enter total' },
                      { key: 'denominations', label: 'Count notes' },
                    ] as const).map(m => (
                      <button
                        key={m.key}
                        onClick={() => setCountMode(m.key)}
                        className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-colors ${
                          countMode === m.key ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {countMode === 'total' ? (
                  <div className="h-[62px] border-2 border-[#CBD5E1] focus-within:border-[var(--pos-primary,#F59E0B)] rounded-[14px] bg-white flex items-center px-4 transition-colors">
                    <span className="text-[15px] font-bold text-[#D97706] mr-3">PKR</span>
                    <div className="w-[2px] h-6 bg-[#CBD5E1]" />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent border-none text-right text-[26px] font-bold text-[#0F172A] focus:ring-0 placeholder:text-[#94A3B8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="border border-[#E2E8F0] rounded-[14px] overflow-hidden">
                    {DENOMINATIONS.map((d, i) => (
                      <div key={d} className={`flex items-center gap-3 px-3.5 py-2 ${i > 0 ? 'border-t border-[#F1F5F9]' : ''}`}>
                        <span className="w-[68px] text-[13px] font-bold text-[#0F172A] tabular-nums">{d.toLocaleString()}</span>
                        <span className="text-[#CBD5E1] text-[13px]">×</span>
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
                          className="w-16 border border-[#E2E8F0] rounded-lg px-2 py-1 text-[14px] font-bold text-center outline-none focus:border-[var(--pos-primary,#F59E0B)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="flex-1 text-right text-[13px] font-bold text-[#475569] tabular-nums">
                          {(counts[d] || 0) > 0 ? pkr(d * counts[d]) : '—'}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3.5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                      <span className="text-[12px] font-bold text-[#0F172A] uppercase tracking-[0.05em]">Counted</span>
                      <span className="text-[20px] font-bold text-[#0F172A] tabular-nums">{pkr(denominationTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Variance */}
                <div className="mt-3 min-h-[24px]">
                  {closingCash !== '' && (
                    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold ${
                      Math.round(variance) === 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : variance > 0
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {Math.round(variance) === 0 ? 'check_circle' : variance > 0 ? 'trending_up' : 'trending_down'}
                      </span>
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
                <label className="flex items-center gap-1.5 text-[12px] font-bold text-[#0F172A] uppercase tracking-[0.05em] mb-2">
                  <span className="material-symbols-outlined text-[14px]">edit_note</span>
                  Notes <span className="text-[#64748B] font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain any variance, refunds or payouts…"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-[14px] p-3.5 text-[#0F172A] text-[14px] outline-none focus:border-[var(--pos-primary,#F59E0B)] transition-colors resize-none h-[80px] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || closingCash === ''}
            className="w-full h-[54px] rounded-[14px] bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
                Close shift &amp; save report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
