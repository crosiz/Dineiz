import React from 'react';
import { useRouter } from 'next/navigation';
import { ManagerOverrideModal } from './ManagerOverrideModal';

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
}

export function ShiftCloseBlockerModal({ isOpen, onClose, blockers, onForceClose }: ShiftCloseBlockerModalProps) {
  const router = useRouter();
  const [showOverride, setShowOverride] = React.useState(false);

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
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div 
        className="relative z-10 w-full max-w-[500px] min-w-[320px] bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col"
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-rose-500 text-[32px]">warning</span>
          </div>
          <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight mb-2">Shift Cannot Be Closed</h2>
          <p className="text-[15px] text-slate-500 font-medium">There are unresolved items that require your attention before closing this shift.</p>
        </div>

        <div className="px-8 pb-6 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
          {blockers.map((blocker, idx) => (
            <div key={idx} className="p-4 rounded-[20px] bg-slate-50 border border-slate-100 transition-all hover:bg-slate-100/50">
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${blocker.type === 'PENDING_ORDERS' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {blocker.type === 'PENDING_ORDERS' ? 'receipt_long' : 'group'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[16px] text-slate-900 tracking-tight">
                    {blocker.type === 'PENDING_ORDERS' ? 'Unpaid Orders' : 'Only Cashier Active'}
                  </h3>
                  <p className="text-[14px] text-slate-500 mt-1 leading-relaxed">
                    {blocker.message}
                  </p>

                  {blocker.orders && blocker.orders.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {blocker.orders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200/60 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[14px] text-slate-900">#{o.orderNumber || o.id.slice(-4)}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[12px] font-bold text-slate-600 tracking-wide uppercase">
                              {o.table?.label || 'Takeaway'}
                            </span>
                          </div>
                          <span className="text-[14px] font-bold text-slate-900">PKR {o.totalAmount?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              router.push('/pos/tickets');
            }}
            className="w-full h-[52px] rounded-2xl bg-slate-900 text-white font-bold text-[15px] hover:bg-slate-800 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(15,23,42,0.15)]"
          >
            Resolve Orders First
          </button>
          <button
            onClick={() => setShowOverride(true)}
            className="w-full h-[52px] rounded-2xl bg-transparent border-2 border-slate-200 text-slate-600 font-bold text-[15px] hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all"
          >
            Request Manager Override
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
    </div>
  );
}
