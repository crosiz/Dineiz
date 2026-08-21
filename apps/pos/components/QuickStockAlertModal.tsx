'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/store';
import { ManagerOverrideModal } from './ManagerOverrideModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface StockAlertPayload {
  ingredientId: string;
  name: string;
  affectedItems: Array<{ id: string; name: string }>;
}

interface QuickStockAlertModalProps {
  alert: StockAlertPayload | null;
  onDismiss: () => void;
}

/**
 * Non-blocking, toast-adjacent alert fired when the `/pos` socket emits
 * `inventory:out_of_stock` for the cashier's branch. Scoped strictly to
 * reacting to that event — it does not hook into the add-to-cart flow or
 * touch cart/order state. "Add Anyway" only verifies the manager PIN; the
 * actual sale still goes through the normal order flow untouched.
 */
export function QuickStockAlertModal({ alert, onDismiss }: QuickStockAlertModalProps) {
  const session = useCartStore((s) => s.session);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  if (!alert) return null;

  const itemNames = alert.affectedItems.map((i) => i.name);
  const itemsLabel = itemNames.length > 0 ? itemNames.join(', ') : 'Some menu items';

  const handleMarkUnavailable = async () => {
    if (alert.affectedItems.length === 0) {
      onDismiss();
      return;
    }
    setIsMarking(true);
    try {
      const res = await fetch(`${API_URL}/api/menu/items/bulk-availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          itemIds: alert.affectedItems.map((i) => i.id),
          isAvailable: false,
          branchId: session.branchId,
        }),
      });
      if (!res.ok) throw new Error('Failed to update availability');
      toast.success(`${itemsLabel} marked unavailable`);
      onDismiss();
    } catch {
      toast.error('Could not mark items unavailable');
    } finally {
      setIsMarking(false);
    }
  };

  const handleOverrideConfirm = async (pin: string, _reason: string) => {
    const res = await fetch(`${API_URL}/api/pos/auth/validate-manager-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({ pin, branchId: session.branchId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid PIN');
    }
    toast.success('Manager override authorized. Continue taking the order as normal.');
    setShowPinModal(false);
    onDismiss();
  };

  return (
    <>
      {!showPinModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />
          <div
            className="relative z-10 w-full max-w-[420px] bg-white rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden"
            style={{ animation: 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="p-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[16px] font-bold text-[#0F172A] leading-snug">
                    {itemsLabel} cannot be made
                  </h2>
                  <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
                    <span className="font-semibold text-rose-600">{alert.name}</span> is out of stock.
                  </p>
                </div>
                <button onClick={onDismiss} className="text-[#94A3B8] hover:text-[#0F172A] shrink-0" title="Dismiss">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-6 pt-2 flex flex-col gap-2.5">
              <button
                onClick={handleMarkUnavailable}
                disabled={isMarking}
                className="w-full h-[48px] rounded-xl bg-[#0F172A] text-white font-bold text-[14px] hover:bg-[#1E293B] disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                {isMarking ? 'Updating…' : 'Mark Item(s) Unavailable'}
              </button>
              <button
                onClick={() => setShowPinModal(true)}
                className="w-full h-[48px] rounded-xl bg-white border border-[#E2E8F0] text-[#475569] font-bold text-[14px] hover:bg-[#F8FAFC] active:scale-[0.98] transition-all"
              >
                Add Anyway (Manager Override)
              </button>
              <button
                onClick={onDismiss}
                className="w-full h-[42px] rounded-xl text-[#94A3B8] font-semibold text-[13px] hover:text-[#64748B] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slide-up {
              from { opacity: 0; transform: translateY(24px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}} />
        </div>
      )}

      {showPinModal && (
        <ManagerOverrideModal
          isOpen={true}
          onClose={() => setShowPinModal(false)}
          onConfirm={handleOverrideConfirm}
          title="Manager Override"
          description={`Enter your manager PIN and a reason to add ${itemsLabel} even though ${alert.name} is out of stock.`}
          reasonLabel="Reason for Override"
          reasonPlaceholder="e.g. Substituting with backup ingredient"
          confirmLabel="Authorize Override"
        />
      )}
    </>
  );
}
