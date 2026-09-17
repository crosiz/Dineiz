'use client'

import React, { useState } from 'react';
import { getPosSession, getToken } from '@/lib/pos-session';
import { toast } from 'sonner';
import { AdminPinModal } from '@/components/AdminPinModal';
import { useBrandingStore } from '@/lib/branding-store';
import { API_URL } from '@/lib/api';
import { Minus, Plus } from 'lucide-react';

interface VoidItemBottomSheetProps {
  isOpen: boolean;
  item: any; // OrderItem
  onClose: () => void;
  onSuccess: (updatedOrder: any) => void;
  voidRequiresManagerApproval: boolean;
}

export function VoidItemBottomSheet({
  isOpen,
  item,
  onClose,
  onSuccess,
  voidRequiresManagerApproval
}: VoidItemBottomSheetProps) {
  const [reason, setReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');
  const [quantityToVoid, setQuantityToVoid] = useState<number>(item?.quantity || 1);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRemoteId, setPendingRemoteId] = useState<string | null>(null);

  const session = getPosSession() || { branchId: '' };

  // Reset state when opened for a new item
  React.useEffect(() => {
    if (isOpen && item) {
      setQuantityToVoid(item.quantity);
      setReason('');
      setOtherReason('');
      setPendingRemoteId(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const reasons = [
    'Customer changed mind',
    'Wrong item ordered',
    'Availability issue',
    'Manager instruction'
  ];

  const handleContinue = () => {
    const finalReason = reason === 'Other' ? otherReason : reason;
    if (!finalReason.trim()) {
      toast.error('Please provide a reason for removing the item.');
      return;
    }

    if (voidRequiresManagerApproval) {
      setIsPinModalOpen(true);
    } else {
      executeVoid();
    }
  };

  const handleRequestRemoteApproval = async () => {
    const finalReason = reason === 'Other' ? otherReason : reason;
    if (!finalReason.trim()) {
      toast.error('Please provide a reason for removing the item.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/pos/void-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          branchId: session.branchId,
          orderId: item.orderId,
          orderItemId: item.id,
          quantity: quantityToVoid,
          reason: finalReason
        }),
      });

      if (!res.ok) throw new Error('Failed to request remote approval');
      toast.success('Approval request sent to manager');
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };



  const handlePinSuccess = (managerId?: string) => {
    setIsPinModalOpen(false);
    executeVoid(managerId);
  };

  const executeVoid = async (managerId?: string) => {
    setIsSubmitting(true);
    const finalReason = reason === 'Other' ? otherReason : reason;

    try {
      const res = await fetch(`${API_URL}/api/orders/${item.orderId}/items/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          reason: finalReason,
          quantity: quantityToVoid,
          approvedByManagerId: managerId 
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to void item');
      }

      const updatedOrder = await res.json();
      
      try {
        const branding = useBrandingStore.getState().branding;
        if (branding.autoKotPrint !== false) {
          const { printDocument } = await import('@/lib/print.service');
          
          await printDocument('CANCELLATION_KOT', {
            ...updatedOrder,
            items: [{
              ...item,
              quantity: quantityToVoid, // the amount voided
              name: item.itemName || item.item?.name,
              variationName: item.variationName,
              addOnNames: item.addOnNames || []
            }],
            cancellationReason: finalReason,
            cancelledBy: (session as any).cashierId || (session as any).userId || 'Cashier',
            approvedBy: managerId
          } as any);
        }
      } catch (printErr) {
        console.error('Failed to print void KOT:', printErr);
      }

      toast.success('Item voided successfully');
      onSuccess(updatedOrder);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* z-[110], not z-[100]: OrderDetailsModal renders this as its own
          child at that same z-[100], which only "worked" because this
          happens to be a later DOM sibling — no real stacking guarantee.
          110 matches the tier OrderDetailsModal already uses for its other
          nested overlay (the inline assign-waiter sheet). */}
      <div className="fixed inset-0 z-[110] flex items-end justify-center pointer-events-auto sm:items-center">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal/Sheet */}
        <div className="relative w-full max-w-[500px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 max-h-[90dvh] flex flex-col">
          {/* flex-1 min-h-0 overflow-y-auto here, not on the whole card body
              — the Cancel/Remove buttons used to live inside this same
              scroll region and could scroll out of view on a short
              viewport instead of staying reachable as a pinned footer. */}
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <h2 className="text-[20px] font-bold text-ink mb-1">Remove Sent Item</h2>
            <p className="text-[14px] text-ink-3 mb-6">
              This item has already been sent to the kitchen. Why are you removing it?
            </p>

            <div className="bg-canvas border border-line p-4 rounded-xl mb-6">
              <h4 className="font-bold text-ink">{item.itemName || item.item?.name}</h4>
              <p className="text-sm text-ink-3">Total Quantity: {item.quantity}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-ink mb-2">Quantity to Remove</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantityToVoid(Math.max(1, quantityToVoid - 1))}
                  disabled={quantityToVoid <= 1}
                  className="w-10 h-10 rounded-xl border border-line-strong flex items-center justify-center text-ink disabled:opacity-50"
                >
                  <Minus className="w-[20px] h-[20px]" />
                </button>
                <span className="font-bold text-xl w-8 text-center">{quantityToVoid}</span>
                <button
                  onClick={() => setQuantityToVoid(Math.min(item.quantity, quantityToVoid + 1))}
                  disabled={quantityToVoid >= item.quantity}
                  className="w-10 h-10 rounded-xl border border-line-strong flex items-center justify-center text-ink disabled:opacity-50"
                >
                  <Plus className="w-[20px] h-[20px]" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-ink mb-3">Reason</label>
              <div className="space-y-3">
                {reasons.map((r) => (
                  <label key={r} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="voidReason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500"
                    />
                    <span className="text-sm text-ink-2 font-medium">{r}</span>
                  </label>
                ))}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="voidReason"
                    value="Other"
                    checked={reason === 'Other'}
                    onChange={() => setReason('Other')}
                    className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-ink-2 font-medium">Other</span>
                </label>
              </div>
              
              {reason === 'Other' && (
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Please specify..."
                  className="mt-3 w-full border border-line-strong rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                />
              )}
            </div>
          </div>

          {/* Pinned footer — outside the scroll region above so these
              buttons are always reachable, not just whenever the content
              happens to fit. */}
          <div className="flex gap-3 p-6 pt-4 shrink-0 border-t border-line">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-white text-ink-3 font-bold text-[14px] rounded-xl border border-line-strong hover:bg-canvas active:scale-95 transition-all"
              >
                Cancel
              </button>


              {voidRequiresManagerApproval ? (
                <>
                  <button
                    onClick={handleRequestRemoteApproval}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-slate-800 text-white font-bold text-[14px] rounded-xl hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    Request Remote
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-red-500 text-white font-bold text-[14px] rounded-xl hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    Enter PIN
                  </button>
                </>
              ) : (
                <button
                  onClick={handleContinue}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-500 text-white font-bold text-[14px] rounded-xl hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Processing...' : 'Remove Item'}
                </button>
              )}
          </div>
        </div>
      </div>

      {isPinModalOpen && (
        <AdminPinModal
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={handlePinSuccess}
        />
      )}
    </>
  );
}
