'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Unlock } from 'lucide-react';
import { getPosSession, getToken } from '@/lib/pos-session';
import { getPosShift } from '@/lib/pos-session';
import { useManagerOverlay } from '@/lib/manager-overlay';
import { API_URL } from '@/lib/api';
import { Dialog, DialogButton } from '@/components/ui/Dialog';
import { PinPad } from '@/components/ui/PinPad';


// Spec Part 10 — start a manager overlay. Manager PIN + a reason + an
// optional "one action only" mode. The cashier's session is untouched.
// Same dialog and keypad as every other PIN prompt (this one used to be a
// password text field with its own amber styling).
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
      if (!res.ok) throw new Error(data.error || 'Could not start manager mode');
      start({ overrideId: data.id, managerId: data.manager.id, managerName: data.manager.name }, { reason: reason.trim(), oneShot });
      toast.success(`Manager mode — ${data.manager.name}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed');
      setPin('');
      setBusy(false);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      z={320}
      icon={Unlock}
      title="Manager mode"
      description={`Approve a void, discount, table or stock change on this terminal without signing ${getPosSession()?.name?.split(' ')[0] ?? 'the cashier'} out. It ends on its own after a few idle minutes.`}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="ink" onClick={submit} disabled={pin.length < 4} busy={busy}>
            {pin.length < 4 ? 'Enter manager PIN' : 'Start manager mode'}
          </DialogButton>
        </>
      }
    >
      <label className="block text-[13px] font-medium text-ink-2 mb-1.5" htmlFor="mm-reason">
        Reason <span className="text-ink-4 font-normal">(optional)</span>
      </label>
      <input
        id="mm-reason"
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Customer changed their order"
        className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line-strong text-[15px] text-ink placeholder:text-ink-4 outline-none focus:border-ink"
      />

      <label className="mt-3 flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={oneShot} onChange={(e) => setOneShot(e.target.checked)} className="w-4 h-4 accent-brand" />
        <span className="text-[13px] text-ink-2">End after one action</span>
      </label>

      <p className="mt-5 mb-3 text-[13px] font-medium text-ink-2 text-center">Manager PIN</p>
      <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} error={!!error} disabled={busy} />

      {error && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </Dialog>
  );
}
