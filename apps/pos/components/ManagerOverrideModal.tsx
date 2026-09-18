import React, { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Dialog, DialogButton } from '@/components/ui/Dialog';
import { PinPad } from '@/components/ui/PinPad';

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string, reason: string) => Promise<void>;
  /** Defaults to the original shift-force-close copy so existing callers are unaffected. */
  title?: string;
  description?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
}

// Manager PIN + reason, for anything that needs a manager's sign-off (force
// closing a shift, adopting orphaned orders…).
//
// The reason used to sit below a 60px-key keypad inside a scrolling area, so on
// a landscape tablet it was off-screen: the manager entered the PIN, the button
// stayed grey, and nothing said why. The reason now comes first, the keypad is
// compact enough that the whole dialog fits, and the button names what's still
// missing instead of just being disabled.
export function ManagerOverrideModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Manager override',
  description = 'A manager’s PIN and a reason are needed to force close this shift.',
  reasonLabel = 'Reason',
  reasonPlaceholder = 'e.g. Customer left without paying',
  confirmLabel = 'Force close',
}: ManagerOverrideModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const ready = pin.length === 4 && reason.trim().length > 0;
  const buttonLabel = !reason.trim() ? 'Add a reason' : pin.length < 4 ? 'Enter manager PIN' : confirmLabel;

  const handleSubmit = async () => {
    if (!ready) return;
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(pin, reason.trim());
    } catch (e: any) {
      setError(e.message || 'That PIN wasn’t accepted.');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Always opened on top of another dialog (orphan adoption, shift-close
    // blockers), so it stacks above all of them.
    <Dialog
      onClose={onClose}
      z={400}
      icon={ShieldCheck}
      tone="neutral"
      title={title}
      description={description}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton variant="ink" onClick={handleSubmit} disabled={!ready} busy={isSubmitting}>
            {buttonLabel}
          </DialogButton>
        </>
      }
    >
      <label className="block text-[13px] font-medium text-ink-2 mb-1.5" htmlFor="override-reason">{reasonLabel}</label>
      <input
        id="override-reason"
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={reasonPlaceholder}
        className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line-strong text-[15px] text-ink placeholder:text-ink-4 outline-none focus:border-ink"
      />

      <p className="mt-5 mb-3 text-[13px] font-medium text-ink-2 text-center">Manager PIN</p>
      <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} error={!!error} disabled={isSubmitting} />

      {error && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-danger">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </Dialog>
  );
}
