'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken, getPosShift, resolveActiveShiftId } from '@/lib/pos-session';
import { Wallet, X, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

/** The reasons cash actually moves in and out of a POS drawer mid-shift. */
const REASONS: Record<'CASH_IN' | 'CASH_OUT', string[]> = {
  CASH_IN: ['Change from safe', 'Float top-up', 'Petty cash returned'],
  CASH_OUT: ['Safe drop', 'Paid out — supplies', 'Paid out — delivery rider', 'Refund paid in cash'],
};

/**
 * Records a mid-shift cash movement.
 *
 * These entries are part of the shift's expected-cash figure, so a safe drop
 * that never gets recorded shows up at close as a shortage the cashier can't
 * explain. The API has always supported them (`POST /api/shifts/:id/cash-entries`,
 * which also writes the shift timeline entry) — there was simply no way to
 * enter one from the POS.
 */
export function CashDrawerModal({
  isOpen,
  shiftId,
  onClose,
}: {
  isOpen: boolean;
  shiftId: string | null | undefined;
  onClose: () => void;
}) {
  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_OUT');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loadError, setLoadError] = useState('');

  const [activeShiftId, setActiveShiftId] = useState<string | null>(shiftId || getPosShift()?.shiftId || null);

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setReason('');

    // The prop and getPosShift() are both just localStorage — the inactivity
    // sweeper can auto-close a shift server-side with no client-side signal,
    // and getShiftSummary doesn't check status, so a stale id used to load
    // and display a dead shift's numbers as if they were live.
    (async () => {
      const resolvedId = await resolveActiveShiftId(API_URL);
      setActiveShiftId(resolvedId);
      setLoadError(resolvedId ? '' : 'No open shift on this terminal.');
      if (!resolvedId) return;

      const auth = { headers: { Authorization: `Bearer ${getToken()}` } };

      fetch(`${API_URL}/api/shifts/${resolvedId}/summary`, auth)
        .then(async r => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `Couldn't load the shift (${r.status})`);
          return r.json();
        })
        .then(s => { setSummary(s); setLoadError(''); })
        .catch(e => setLoadError(e?.message || 'Could not load this shift.'));

      fetch(`${API_URL}/api/shifts/${resolvedId}`, auth)
        .then(r => (r.ok ? r.json() : null))
        .then(d => setEntries(d?.cashEntries ?? []))
        .catch(() => {});
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!activeShiftId) { toast.error('No open shift on this terminal'); return; }
    if (amount === '' || Number(amount) <= 0) { toast.error('Enter an amount greater than zero'); return; }
    if (!reason.trim()) { toast.error('Pick or type a reason — this is what the manager sees'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/shifts/${activeShiftId}/cash-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ type, amount: Number(amount), reason: reason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not record the cash movement');
      }
      const entry = await res.json();
      setEntries(prev => [...prev, entry]);
      setSummary((s: any) =>
        s ? {
          ...s,
          cashIn: type === 'CASH_IN' ? (s.cashIn ?? 0) + Number(amount) : s.cashIn,
          cashOut: type === 'CASH_OUT' ? (s.cashOut ?? 0) + Number(amount) : s.cashOut,
          expectedCash: (s.expectedCash ?? 0) + (type === 'CASH_IN' ? Number(amount) : -Number(amount)),
        } : s,
      );
      setAmount('');
      setReason('');
      toast.success(`${type === 'CASH_IN' ? 'Cash in' : 'Cash out'} recorded`);
    } catch (e: any) {
      toast.error(e.message || 'Could not record the cash movement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in ">
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-slide-up">

        <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide leading-none">Cash drawer</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Record money in or out mid-shift</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">

          {loadError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-semibold text-rose-700">
              {loadError}
            </div>
          )}

          {summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-baseline justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected in drawer now</span>
              <span className="text-base font-bold tabular-nums">{pkr(summary.expectedCash ?? 0)}</span>
            </div>
          )}

          {/* Direction */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {([
              { key: 'CASH_OUT', label: 'Cash out', Icon: ArrowUp },
              { key: 'CASH_IN', label: 'Cash in', Icon: ArrowDown },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setReason(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-colors ${
                  type === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <t.Icon size={15} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2">Amount</label>
            <div className="h-[58px] border-2 border-slate-200 focus-within:border-[#FF5722] rounded-xl bg-white flex items-center px-4 transition-colors">
              <span className="text-xs font-bold text-[#FF5722] mr-3">PKR</span>
              <div className="w-[2px] h-6 bg-[#CBD5E1]" />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                autoFocus
                className="w-full bg-transparent border-none text-right text-xl font-bold focus:ring-0 placeholder:text-slate-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2">Reason</label>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {REASONS[type].map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    reason === r
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Or type your own reason…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#FF5722] transition-colors placeholder:text-slate-400"
            />
          </div>

          {/* Already recorded this shift */}
          {entries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">This shift</p>
              <div className="border border-slate-200 rounded-xl divide-y divide-[#F1F5F9] max-h-[160px] overflow-y-auto custom-scrollbar">
                {entries.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between px-3.5 py-2.5">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold">{e.type === 'CASH_IN' ? 'Cash in' : 'Cash out'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{e.reason || 'No reason given'}</p>
                    </div>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${e.type === 'CASH_OUT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {e.type === 'CASH_OUT' ? '−' : '+'}{pkr(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={submit}
            disabled={submitting || amount === '' || !reason.trim()}
            className="w-full h-[52px] rounded-xl bg-[#FF5722] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {submitting
              ? <Loader2 size={16} className="animate-spin" />
              : <>Record {type === 'CASH_IN' ? 'cash in' : 'cash out'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
