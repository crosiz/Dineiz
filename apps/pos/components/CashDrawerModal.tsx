'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/pos-session';

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

  useEffect(() => {
    if (!isOpen || !shiftId) return;
    setAmount('');
    setReason('');

    fetch(`${API_URL}/api/shifts/${shiftId}/summary`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});

    fetch(`${API_URL}/api/shifts/${shiftId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setEntries(d?.cashEntries ?? []))
      .catch(() => {});
  }, [isOpen, shiftId]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!shiftId) { toast.error('No open shift on this terminal'); return; }
    if (amount === '' || Number(amount) <= 0) { toast.error('Enter an amount greater than zero'); return; }
    if (!reason.trim()) { toast.error('Pick or type a reason — this is what the manager sees'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/shifts/${shiftId}/cash-entries`, {
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in font-body-md text-[#0F172A]">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[92vh] animate-slide-up">

        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-sky-600">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="text-[20px] font-bold clash-display tracking-wide leading-none">Cash drawer</h2>
              <p className="text-[13px] text-[#64748B] font-medium mt-1">Record money in or out mid-shift</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">

          {summary && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px] p-4 flex items-baseline justify-between">
              <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-[0.05em]">Expected in drawer now</span>
              <span className="text-[20px] font-bold tabular-nums">{pkr(summary.expectedCash ?? 0)}</span>
            </div>
          )}

          {/* Direction */}
          <div className="flex bg-[#F1F5F9] rounded-xl p-1">
            {([
              { key: 'CASH_OUT', label: 'Cash out', icon: 'arrow_upward' },
              { key: 'CASH_IN', label: 'Cash in', icon: 'arrow_downward' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setReason(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[14px] font-bold rounded-lg transition-colors ${
                  type === t.key ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-[0.05em] mb-2">Amount</label>
            <div className="h-[58px] border-2 border-[#CBD5E1] focus-within:border-[var(--pos-primary,#F59E0B)] rounded-[14px] bg-white flex items-center px-4 transition-colors">
              <span className="text-[15px] font-bold text-[#D97706] mr-3">PKR</span>
              <div className="w-[2px] h-6 bg-[#CBD5E1]" />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                autoFocus
                className="w-full bg-transparent border-none text-right text-[24px] font-bold focus:ring-0 placeholder:text-[#94A3B8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-[0.05em] mb-2">Reason</label>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {REASONS[type].map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors ${
                    reason === r
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]'
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
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-[12px] px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--pos-primary,#F59E0B)] transition-colors placeholder:text-[#94A3B8]"
            />
          </div>

          {/* Already recorded this shift */}
          {entries.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-2">This shift</p>
              <div className="border border-[#E2E8F0] rounded-[14px] divide-y divide-[#F1F5F9] max-h-[160px] overflow-y-auto custom-scrollbar">
                {entries.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between px-3.5 py-2.5">
                    <div className="min-w-0 pr-3">
                      <p className="text-[13px] font-semibold">{e.type === 'CASH_IN' ? 'Cash in' : 'Cash out'}</p>
                      <p className="text-[12px] text-[#94A3B8] truncate">{e.reason || 'No reason given'}</p>
                    </div>
                    <span className={`text-[13px] font-bold tabular-nums shrink-0 ${e.type === 'CASH_OUT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {e.type === 'CASH_OUT' ? '−' : '+'}{pkr(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={submit}
            disabled={submitting || amount === '' || !reason.trim()}
            className="w-full h-[52px] rounded-[14px] bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {submitting
              ? <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span>
              : <>Record {type === 'CASH_IN' ? 'cash in' : 'cash out'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
