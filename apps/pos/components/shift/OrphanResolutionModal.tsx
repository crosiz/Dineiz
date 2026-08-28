'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPKR } from '@/lib/utils';
import { ManagerOverrideModal } from '../ManagerOverrideModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface OrphanOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  total: number;
  itemCount: number;
  tableLabel: string | null;
  createdAt: string;
  originalShiftId: string;
  originalShiftStatus: string | null;
  originalCashier: string | null;
}

interface Props {
  orphans: OrphanOrder[];
  branchId: string;
  intoShiftId: string;
  token: string | null;
  /** Called after each successful resolve — parent refetches; empty list dismisses. */
  onResolved: () => void;
}

/**
 * Spec Part 2 — orphan orders. Blocking. Appears before the home screen when
 * a shift opens and finds still-active orders left under a shift that has
 * since closed. Nothing is ever silently carried over: every orphan must be
 * adopted into the new shift (manager PIN) or cancelled (manager PIN).
 */
export function OrphanResolutionModal({ orphans, branchId, intoShiftId, token, onResolved }: Props) {
  const [pending, setPending] = useState<{ order: OrphanOrder; action: 'ADOPT' | 'CANCEL' } | null>(null);

  if (orphans.length === 0) return null;

  const resolve = async (pin: string, reason: string) => {
    if (!pending) return;
    const res = await fetch(`${API_URL}/api/pos/orphans/${pending.order.id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: pending.action,
        intoShiftId: pending.action === 'ADOPT' ? intoShiftId : undefined,
        overridePin: pin,
        overrideReason: reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not resolve this order');
    }
    toast.success(
      pending.action === 'ADOPT'
        ? `${pending.order.orderNumber} adopted into your shift`
        : `${pending.order.orderNumber} cancelled`,
    );
    setPending(null);
    onResolved();
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-[540px] bg-white rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-6 pb-4 border-b border-[#F1F5F9]">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-[#0F172A] leading-snug">
                  {orphans.length} order{orphans.length === 1 ? '' : 's'} from a previous shift {orphans.length === 1 ? 'is' : 'are'} still open
                </h2>
                <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">
                  Resolve each one before starting. Adopting moves it into your shift; cancelling voids it.
                  Both need a manager PIN.
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[46vh] overflow-y-auto divide-y divide-[#F1F5F9]">
            {orphans.map((o) => (
              <div key={o.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums font-bold text-[14px] text-[#0F172A]">{o.orderNumber}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">{o.status}</span>
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-0.5 truncate">
                    {o.tableLabel ? `Table ${o.tableLabel}` : o.type} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatPKR(o.total)}
                    {o.originalCashier ? ` · ${o.originalCashier}` : ''}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setPending({ order: o, action: 'ADOPT' })}
                    className="h-[38px] px-3 rounded-lg bg-[#0F172A] text-white font-bold text-[12px] hover:bg-[#1E293B] active:scale-[0.98] transition-all"
                  >
                    Adopt
                  </button>
                  <button
                    onClick={() => setPending({ order: o, action: 'CANCEL' })}
                    className="h-[38px] px-3 rounded-lg bg-white border border-[#E2E8F0] text-[#B91C1C] font-bold text-[12px] hover:bg-rose-50 active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#F8FAFC] text-center text-[12px] text-[#94A3B8]">
            You cannot start taking orders until every item above is resolved.
          </div>
        </div>
      </div>

      {pending && (
        <ManagerOverrideModal
          isOpen
          onClose={() => setPending(null)}
          onConfirm={resolve}
          title={pending.action === 'ADOPT' ? 'Adopt Order' : 'Cancel Orphan Order'}
          description={
            pending.action === 'ADOPT'
              ? `Enter your manager PIN and a reason to move ${pending.order.orderNumber} into the current shift.`
              : `Enter your manager PIN and a reason to cancel ${pending.order.orderNumber}. This voids the order.`
          }
          reasonLabel="Reason"
          reasonPlaceholder={pending.action === 'ADOPT' ? 'e.g. Continuing service for table 5' : 'e.g. Customer left, food not made'}
          confirmLabel={pending.action === 'ADOPT' ? 'Adopt Order' : 'Cancel Order'}
        />
      )}
    </>
  );
}
