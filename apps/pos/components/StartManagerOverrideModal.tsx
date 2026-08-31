'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Unlock } from 'lucide-react';
import { getPosSession, getToken } from '@/lib/pos-session';
import { getPosShift } from '@/lib/pos-session';
import { useManagerOverlay } from '@/lib/manager-overlay';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Spec Part 10 — start a manager overlay. Manager PIN + a reason + an
// optional "one action only" mode. The cashier's session is untouched.
export function StartManagerOverrideModal({ onClose }: { onClose: () => void }) {
  const start = useManagerOverlay((s) => s.start);
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [oneShot, setOneShot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (pin.length < 4) { setError('Enter the 4-digit manager PIN'); return; }
    setBusy(true);
    setError('');
    try {
      const s = getPosSession();
      const res = await fetch(`${API_URL}/api/pos/manager-override/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: JSON.stringify({
          pin, reason: reason.trim() || undefined, oneShot,
          branchId: s?.branchId, shiftId: getPosShift()?.shiftId,
          cashierId: s?.userId, cashierName: s?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start manager override');
      start({ overrideId: data.id, managerId: data.manager.id, managerName: data.manager.name }, { reason: reason.trim(), oneShot });
      toast.success(`Manager mode — ${data.manager.name}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <Unlock size={19} />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Manager Override</h2>
        <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
          Act on this terminal to approve a void, discount, table or stock change — without signing
          {' '}{getPosSession()?.name ?? 'the cashier'} out. It ends on its own after a few idle minutes.
        </p>

        {error && <div className="mb-3 text-[12px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Manager PIN</label>
        <input
          type="password" inputMode="numeric" maxLength={8} value={pin} autoFocus
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full h-11 rounded-xl border border-slate-200 px-3 text-lg font-bold tracking-[0.3em] text-center outline-none focus:border-[#FF5722] mb-3"
          placeholder="••••"
        />

        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full h-16 rounded-xl border border-slate-200 p-2.5 text-[13px] outline-none focus:border-[#FF5722] resize-none mb-3"
          placeholder="e.g. Customer changed their order"
        />

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={oneShot} onChange={(e) => setOneShot(e.target.checked)} className="w-4 h-4 accent-[#FF5722]" />
          <span className="text-[12px] text-slate-600">Exit automatically after one action</span>
        </label>

        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="flex-1 h-10 rounded-xl bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {busy ? 'Starting…' : 'Start Manager Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
