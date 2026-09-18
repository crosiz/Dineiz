import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogButton } from './ui/Dialog';
import { OrderTypeBadge } from './OrderStatusBadge';
import { formatPKR } from '@/lib/utils';
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

  const orders = blockers.flatMap((b) => (Array.isArray(b.orders) ? b.orders : []));
  const lastCashier = blockers.some((b) => b.type === 'SOLE_CASHIER_ACTIVE');

  return (
    <Dialog
      onClose={onClose}
      z={200}
      size="md"
      icon={AlertTriangle}
      tone="warn"
      title="Settle open orders before closing"
      description={
        blockers.length === 1
          ? blockers[0].message
          : blockers.map((b) => b.message).join(' ')
      }
      footer={
        <>
          <DialogButton onClick={() => { onClose(); router.push('/pos/tickets'); }}>Open tickets</DialogButton>
          <DialogButton variant="ink" onClick={() => setShowOverride(true)}>Manager override</DialogButton>
        </>
      }
    >
      {orders.length > 0 ? (
        <ul className="border border-line rounded-xl divide-y divide-line overflow-hidden">
          {orders.map((o: any) => {
            const done = resolved.has(o.id);
            return (
              <li key={o.id} className={`px-3.5 py-3 flex items-center gap-3 ${done ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-ink tabular-nums whitespace-nowrap">#{o.orderNumber || o.id.slice(-4)}</span>
                    <OrderTypeBadge type={o.table?.label ? 'DINE_IN' : 'TAKEAWAY'} tableLabel={o.table?.label} size="sm" />
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">
                    {formatPKR(Number(o.netAmount ?? o.totalAmount ?? 0))}
                    {o.status ? ` · ${String(o.status).replace('_', ' ').toLowerCase()}` : ''}
                  </p>
                </div>
                {done ? (
                  <span className="text-[12.5px] font-medium text-ink-3">Cancelled</span>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => cancelFromList(o.id)}
                      disabled={busyId === o.id}
                      className="h-9 px-3 rounded-lg border border-line text-[13px] font-semibold text-danger hover:bg-danger/10 hover:border-danger/30 disabled:opacity-50"
                    >
                      {busyId === o.id ? 'Working…' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => { onClose(); router.push(`/pos/order?orderId=${o.id}&checkout=true`); }}
                      className="h-9 px-3.5 rounded-lg bg-brand text-on-brand text-[13px] font-semibold hover:bg-brand-strong"
                    >
                      Settle
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-2">
          {lastCashier
            ? 'Settle the branch’s open orders from Tickets, or ask a manager to close anyway.'
            : 'Resolve the items above, or ask a manager to close anyway.'}
        </p>
      )}
    </Dialog>
  );
}
