'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, CloudOff, LogOut } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import {
  getUnsyncedSummary, getSyncCategoryProgress, kickOutbox,
  type UnsyncedSummary, type SyncCategoryProgress,
} from '@/lib/core/outbox';
import { shiftSyncCompleted } from '@/lib/core/commands';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Spec Part 6 — the terminal keeps shipping a shift that was closed with a
 * queue still pending. This screen stays mounted (so the outbox drain loop
 * keeps running) and shows progress. When the queue empties it finalises the
 * shift server-side and returns to login. The cashier can leave at any time;
 * the events survive in IndexedDB and finish on the next login here.
 */
export default function ShiftSyncedPage() {
  const router = useRouter();
  const params = useSearchParams();
  const shiftId = params.get('shiftId');

  const [summary, setSummary] = useState<UnsyncedSummary | null>(null);
  const [cat, setCat] = useState<SyncCategoryProgress>({ payments: 0, orders: 0, other: 0, total: 0 });
  const [done, setDone] = useState(false);
  const baseRef = useRef<SyncCategoryProgress | null>(null);
  const finishingRef = useRef(false);

  const clearAndLeave = () => {
    try {
      localStorage.removeItem('pos_session');
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_shift');
    } catch { /* ignore */ }
    router.replace('/login');
  };

  const finalise = async () => {
    if (finishingRef.current || !shiftId) return;
    finishingRef.current = true;
    try {
      await fetch(`${API_URL}/api/shifts/${shiftId}/sync-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      }).catch(() => {});
      shiftSyncCompleted(shiftId).catch(() => {});
    } finally {
      setDone(true);
    }
  };

  useEffect(() => {
    kickOutbox('immediate');
    const tick = async () => {
      const s = await getUnsyncedSummary();
      const c = await getSyncCategoryProgress();
      if (!baseRef.current) baseRef.current = c;
      setSummary(s);
      setCat(c);
      if (s.count === 0 && !done) void finalise();
    };
    void tick();
    const h = setInterval(tick, 1500);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const base = baseRef.current ?? cat;
  const shipped = Math.max(0, base.total - cat.total);
  const pct = base.total > 0 ? Math.round((shipped / base.total) * 100) : 100;
  const poisoned = summary?.poisoned ?? 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--pos-bg-base)] p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_30px_80px_rgba(15,23,42,0.2)] border border-slate-200 p-7">
        {done ? (
          <>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 size={22} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">Shift fully synced</h1>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Every order and payment from your shift has reached the server. This shift is now finalised.
            </p>
            <button
              onClick={clearAndLeave}
              className="w-full h-11 rounded-xl bg-[#FF5722] text-white font-semibold text-xs hover:bg-orange-600 transition-colors"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <RefreshCw size={20} className="animate-spin" style={{ animationDuration: '1.5s' }} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">Finishing sync</h1>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Your shift is closed. This terminal is still sending{' '}
              <strong className="text-slate-700 tabular-nums">{cat.total} change{cat.total === 1 ? '' : 's'}</strong>{' '}
              to the server. You can wait, or sign out — nothing is lost, it finishes on the next login here.
            </p>

            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
              <div className="h-full bg-[#FF5722] transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 font-medium tabular-nums mb-4">{shipped} of {base.total}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 mb-4 text-xs">
              {(['payments', 'orders', 'other'] as const).map((k) => (
                <div key={k} className="flex items-center justify-between py-1">
                  <span className="text-slate-600 font-medium capitalize">{k}</span>
                  <span className="tabular-nums font-semibold text-slate-900">
                    {Math.max(0, (base[k] || 0) - cat[k])} of {base[k] || 0}
                  </span>
                </div>
              ))}
            </div>

            {poisoned > 0 && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-4">
                <CloudOff size={14} className="text-rose-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  {poisoned} item{poisoned === 1 ? '' : 's'} the server rejected — a manager needs to review these in the admin panel.
                </p>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => kickOutbox('immediate')}
                className="flex-1 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} /> Retry now
              </button>
              <button
                onClick={() => {
                  toast.message('Signing out — remaining changes finish syncing next login on this terminal.');
                  clearAndLeave();
                }}
                className="flex-1 h-10 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
