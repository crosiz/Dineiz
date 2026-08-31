'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { toast } from 'sonner';
import { getToken, getPosSession, clearPosSession, setPosShift } from '@/lib/pos-session';
import { allowsViewMode, enterViewMode } from '@/lib/view-mode';
import { ArrowRight, ChevronDown, Loader2, ShieldCheck } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DENOMS = [5000, 1000, 500, 100, 50, 20, 10, 5];
const QUICK = [2000, 5000, 10000];
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

export default function ShiftOpenGate() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);

  const [float, setFloat] = useState<number | ''>('');
  const [countByNote, setCountByNote] = useState(false);
  const [notes, setNotes] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // localStorage-derived values are only trustworthy after mount, or SSR and
  // the client first render disagree and React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const cashierName = mounted ? session?.cashierName || getPosSession()?.name || 'Operator' : 'Operator';
  const branchName = mounted ? session?.branchName || getPosSession()?.branchName || 'Branch' : 'Branch';
  const role = mounted ? (getPosSession()?.role || 'CASHIER').replace(/_/g, ' ').toLowerCase() : 'cashier';

  // Already have a shift → this screen has nothing to do. Send them on without
  // a toast (the redirect itself is the feedback; the toast fired on every
  // incidental mount and read as an error).
  useEffect(() => {
    if (localStorage.getItem('pos_shift')) router.replace('/pos/home');
  }, [router]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const noteTotal = useMemo(
    () => DENOMS.reduce((sum, d) => sum + d * (notes[d] || 0), 0),
    [notes],
  );
  // When the breakdown is open it is the source of truth for the amount.
  const amount = countByNote ? noteTotal : float === '' ? 0 : float;

  const handleStartShift = async () => {
    if (submitting) return;
    if (amount < 0) {
      toast.error('Enter a valid float amount');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ branchId: session?.branchId, openingFloat: amount }),
      });

      // A shift is already open for this branch/cashier — adopt it rather than
      // erroring. Pull its real openedAt / float from the server so the home
      // screen's elapsed timer and drawer expectation are correct (this used
      // to stamp `new Date()` and a guessed float).
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        const shiftId: string | undefined = body.shiftId;
        if (!shiftId) throw new Error(body.error || 'A shift is already open');

        let openedAt = new Date().toISOString();
        let openingFloat = amount;
        try {
          const s = await fetch(`${API_URL}/api/shifts/${shiftId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (s.ok) {
            const sd = await s.json();
            openedAt = sd.openedAt ?? openedAt;
            openingFloat = sd.openingFloat ?? openingFloat;
          }
        } catch { /* keep the fallbacks */ }

        useCartStore.setState({ session: { ...session, shiftId } });
        setPosShift({ shiftId, openedAt, openingFloat });
        localStorage.removeItem('pos_view_mode');
        toast.success('Resumed your open shift');
        router.replace('/pos/home');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Couldn't open the shift (${res.status})`);
      }

      const data = await res.json();
      if (!data?.id) throw new Error('The server opened the shift but returned no ID');

      useCartStore.setState({ session: { ...session, shiftId: data.id } });
      setPosShift({
        shiftId: data.id,
        openedAt: data.openedAt ?? new Date().toISOString(),
        openingFloat: amount,
      });
      localStorage.removeItem('pos_view_mode');
      toast.success('Shift started');
      router.replace('/pos/home');
    } catch (err: any) {
      console.error('Failed to open shift:', err);
      toast.error(err?.message || 'Error opening shift');
      setSubmitting(false);
    }
    // On success we navigate away — leave `submitting` true so the button
    // stays disabled through the route transition.
  };

  const dateLine = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';
  const timeLine = now
    ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-body-md text-slate-900">
      <main className="w-full max-w-[420px]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.12)] overflow-hidden">

          {/* Identity + context */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Open shift</span>
              <span className="text-[12px] text-slate-400 tabular-nums" suppressHydrationWarning>
                {dateLine}{timeLine && ` · ${timeLine}`}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[15px] shrink-0"
                style={{ backgroundColor: getPosSession()?.avatarColor || 'var(--pos-primary,#FF5722)' }}
                suppressHydrationWarning
              >
                {cashierName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-slate-900 truncate" suppressHydrationWarning>{cashierName}</div>
                <div className="text-[12px] text-slate-500 capitalize truncate" suppressHydrationWarning>{role} · {branchName}</div>
              </div>
              <ShieldCheck size={18} className="ml-auto text-emerald-500 shrink-0" />
            </div>
          </div>

          {/* Float */}
          <div className="p-6">
            <label htmlFor="floatInput" className="block text-[13px] font-bold text-slate-900">
              Opening cash float
            </label>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Count what&apos;s physically in the drawer right now.
            </p>

            <div className="mt-3 h-16 rounded-xl border-2 border-slate-200 bg-white flex items-center gap-3 px-4 transition-colors focus-within:border-[var(--pos-primary,#FF5722)]">
              <span className="text-[15px] font-semibold text-slate-400 shrink-0">PKR</span>
              {/* type="text" + inputMode: a number input renders its own inset
                  field chrome (the faint box the amount sat in) even with
                  appearance:none — this is a plain field we style fully. */}
              <input
                id="floatInput"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                disabled={countByNote}
                value={countByNote ? (noteTotal ? noteTotal.toLocaleString('en-US') : '') : (float === '' ? '' : float.toLocaleString('en-US'))}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 9);
                  setFloat(digits === '' ? '' : Number(digits));
                }}
                className="flex-1 min-w-0 bg-transparent text-right text-[26px] font-bold text-slate-900 tabular-nums placeholder:text-slate-300 outline-none border-none focus:ring-0 disabled:text-slate-500"
              />
            </div>

            {!countByNote && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {QUICK.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFloat(v)}
                    className={`h-9 rounded-lg text-[13px] font-bold border transition-colors ${
                      float === v
                        ? 'border-[var(--pos-primary,#FF5722)] bg-[var(--pos-primary,#FF5722)]/10 text-[var(--pos-primary,#FF5722)]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setCountByNote((v) => !v)}
              className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${countByNote ? 'rotate-180' : ''}`} />
              Count note by note
            </button>

            {countByNote && (
              <div className="mt-3 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {DENOMS.map((d) => {
                  const c = notes[d] || 0;
                  return (
                    <div key={d} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-[13px] font-semibold text-slate-700 w-[4.5rem] tabular-nums">PKR {d.toLocaleString()}</span>
                      <span className="text-slate-300 text-[13px]">×</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={notes[d] || ''}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                          setNotes((p) => ({ ...p, [d]: n || 0 }));
                        }}
                        className="w-14 h-8 text-center rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-900 outline-none focus:border-[var(--pos-primary,#FF5722)]"
                      />
                      <span className="ml-auto text-[13px] font-semibold text-slate-500 tabular-nums">{pkr(d * c)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Total</span>
                  <span className="text-[15px] font-bold text-slate-900 tabular-nums">{pkr(noteTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={handleStartShift}
              disabled={submitting}
              className="w-full h-[52px] rounded-xl bg-[var(--pos-primary,#FF5722)] text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Starting…</>
              ) : (
                <>Start shift <ArrowRight size={18} /></>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Every order from now is tracked against this shift.
            </p>

            {mounted && allowsViewMode() && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => { enterViewMode(); router.replace('/pos/home'); }}
                className="w-full mt-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-semibold hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                Continue without a shift
                <span className="block text-[11px] font-medium text-slate-400 mt-0.5">
                  View orders, reprint, manage tables — no new orders
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => { clearPosSession(); router.push('/login'); }}
              className="w-full mt-3 text-[12px] font-semibold text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
            >
              Switch user
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
