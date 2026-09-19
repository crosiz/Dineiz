'use client';

import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/store';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { API_URL } from '@/lib/api';


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
<Modal isOpen onClose={onDismiss} label="Stock unavailable" sheetOnMobile className="max-w-[420px] overflow-y-auto">
            <div className="p-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} className="text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[16px] font-bold text-ink leading-snug">
                    {itemsLabel} cannot be made
                  </h2>
                  <p className="text-[13px] text-ink-3 mt-1 leading-relaxed">
                    <span className="font-semibold text-rose-600">{alert.name}</span> is out of stock.
                  </p>
                </div>
                <button onClick={onDismiss} className="w-11 h-11 grid place-items-center text-ink-4 hover:text-ink shrink-0" aria-label="Dismiss stock alert">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-6 pt-2 flex flex-col gap-2.5">
              <button
                onClick={handleMarkUnavailable}
                disabled={isMarking}
                className="w-full h-[48px] rounded-xl bg-ink text-white font-bold text-[14px] hover:bg-ink disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                {isMarking ? 'Updating…' : 'Mark Item(s) Unavailable'}
              </button>
              <button
                onClick={() => setShowPinModal(true)}
                className="w-full h-[48px] rounded-xl bg-white border border-line text-ink-2 font-bold text-[14px] hover:bg-canvas active:scale-[0.98] transition-all"
              >
                Add Anyway (Manager Override)
              </button>
              <button
                onClick={onDismiss}
                className="w-full h-11 rounded-xl text-ink-4 font-semibold text-[13px] hover:text-ink-3 transition-colors"
              >
                Cancel
              </button>
            </div>
        </Modal>
      )}

      {showPinModal && (
        <ManagerOverrideModal
          isOpen={true}
          onClose={() => setShowPinModal(false)}
          onConfirm={handleOverrideConfirm}
          title="Add despite low stock"
          description={`${alert.name} is out of stock. A manager can still add ${itemsLabel}.`}
          reasonLabel="Reason"
          reasonPlaceholder="e.g. Substituting with backup ingredient"
          confirmLabel="Add anyway"
        />
      )}
    </>
  );
}
