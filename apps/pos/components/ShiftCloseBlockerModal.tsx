import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Receipt, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ManagerOverrideModal } from './ManagerOverrideModal';
import { cancelOrder } from '@/lib/core/commands';

interface ShiftCloseBlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockers: Array<{
    type: string;
    message: string;
    count: number;
    orders?: any[];
  }>;
  onForceClose: (pin: string, reason: string) => Promise<void>;
  /** Re-run the can-close check after an order is resolved from this list. */
  onResolved?: () => void;
}

export function ShiftCloseBlockerModal({ isOpen, onClose, blockers, onForceClose, onResolved }: ShiftCloseBlockerModalProps) {
  const router = useRouter();
  const [showOverride, setShowOverride] = React.useState(false);
  // Orders cancelled from this list, so the row reflects it immediately —
  // the can-close re-check is a round trip behind.
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Cancelling here goes through the same local-first command the Tickets
  // screen uses, so it applies instantly and the outbox ships it — no need to
  // leave the close flow, walk to Tickets, and start over.
  const cancelFromList = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await cancelOrder(orderId);
      setResolved((prev) => new Set(prev).add(orderId));
      onResolved?.();
    } catch {
      toast.error('Could not cancel that order — open it from Tickets.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  if (showOverride) {
    return (
      <ManagerOverrideModal
        isOpen={true}
        onClose={() => setShowOverride(false)}
        onConfirm={onForceClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      <div 
        className="relative z-10 w-full max-w-[460px] min-w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        <div className="p-6 pb-4 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-3">
            <AlertTriangle size={22} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight mb-1">Shift Cannot Be Closed</h2>
          <p className="text-xs text-slate-500 font-medium">Unresolved items require attention before closing this shift.</p>
        </div>

        <div className="px-6 pb-5 max-h-[48vh] overflow-y-auto space-y-2.5 custom-scrollbar">
          {blockers.map((blocker, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${blocker.type === 'PENDING_ORDERS' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  {blocker.type === 'PENDING_ORDERS' ? (
                    <Receipt size={14} />
                  ) : (
                    <Users size={14} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs text-slate-900">
                    {blocker.type === 'PENDING_ORDERS' ? 'Unpaid Orders' : 'Only Cashier Active'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                    {blocker.message}
                  </p>

                  {blocker.orders && blocker.orders.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {blocker.orders.map((o: any) => {
                        const done = resolved.has(o.id);
                        return (
                          <div key={o.id} className={`flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border text-xs ${done ? 'border-slate-200 opacity-50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-900 font-mono">#{o.orderNumber || o.id.slice(-4)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase shrink-0">
                                {o.table?.label || 'Takeaway'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="font-bold text-slate-900 font-mono">PKR {o.totalAmount?.toLocaleString()}</span>
                              {done ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cancelled</span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => { onClose(); router.push(`/pos/order?orderId=${o.id}&checkout=true`); }}
                                    className="text-[11px] font-semibold text-[#FF5722] hover:underline"
                                  >
                                    Settle
                                  </button>
                                  <button
                                    onClick={() => cancelFromList(o.id)}
                                    disabled={busyId === o.id}
                                    className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
                                  >
                                    {busyId === o.id ? '…' : 'Cancel'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              router.push('/pos/tickets');
            }}
            className="w-full h-10 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
          >
            Resolve Orders First
          </button>
          <button
            onClick={() => setShowOverride(true)}
            className="w-full h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100 active:scale-95 transition-all"
          >
            Request Manager Override
          </button>
        </div>
      </div>
    </div>
  );
}

