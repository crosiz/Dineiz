'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

type PendingAction =
  | { kind: 'one'; order: OrphanOrder; action: 'ADOPT' | 'CANCEL' }
  | { kind: 'all'; action: 'ADOPT' | 'CANCEL' };

/**
 * Spec Part 2 — orphan orders. Blocking. Appears before the home screen when
 * a shift opens and finds still-active orders left under a shift that has
 * since closed. Nothing is ever silently carried over: every orphan must be
 * adopted into the new shift (manager PIN) or cancelled (manager PIN).
 *
 * A closed shift can leave a whole batch of orphans at once (a terminal that
 * died mid-service, a force-close). Resolving dozens one PIN at a time isn't
 * viable, so "Adopt all" / "Cancel all" take a single PIN + reason and apply
 * it to every order shown.
 */
export function OrphanResolutionModal({ orphans, intoShiftId, token, onResolved }: Props) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  if (orphans.length === 0) return null;

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resolveOne = async (order: OrphanOrder, action: 'ADOPT' | 'CANCEL', pin: string, reason: string) => {
    const res = await fetch(`${API_URL}/api/pos/orphans/${order.id}/resolve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action,
        intoShiftId: action === 'ADOPT' ? intoShiftId : undefined,
        overridePin: pin,
        overrideReason: reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Could not resolve ${order.orderNumber}`);
    }
  };

  const resolve = async (pin: string, reason: string) => {
    if (!pending) return;

    if (pending.kind === 'one') {
      await resolveOne(pending.order, pending.action, pin, reason);
      toast.success(
        pending.action === 'ADOPT'
          ? `${pending.order.orderNumber} adopted into your shift`
          : `${pending.order.orderNumber} cancelled`,
      );
      setPending(null);
      onResolved();
      return;
    }

    // Bulk. Run sequentially so one bad PIN fails fast on the first order and
    // a mid-batch failure leaves a clear "resolved N of M" state rather than
    // a pile of parallel rejections.
    const list = [...orphans];
    const action = pending.action;
    setPending(null);
    setBulk({ done: 0, total: list.length });
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        await resolveOne(list[i], action, pin, reason);
        ok++;
      } catch (e: any) {
        failures.push(list[i].orderNumber);
        // A rejected PIN will reject every order — stop rather than hammer.
        if (i === 0 && /pin|permission/i.test(e?.message ?? '')) {
          setBulk(null);
          toast.error(e.message || 'Manager PIN rejected');
          return;
        }
      }
      setBulk({ done: i + 1, total: list.length });
    }
    setBulk(null);
    if (ok > 0) {
      toast.success(`${ok} order${ok === 1 ? '' : 's'} ${action === 'ADOPT' ? 'adopted' : 'cancelled'}`);
    }
    if (failures.length) {
      toast.error(`${failures.length} could not be resolved — ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`);
    }
    onResolved();
  };

  const busy = bulk !== null;

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

          <div className="max-h-[42vh] overflow-y-auto divide-y divide-[#F1F5F9]">
            {orphans.map((o) => (
              <div key={o.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums font-bold text-[14px] text-[#0F172A] inline-block min-w-[8.5ch]">{o.orderNumber}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] shrink-0">{o.status}</span>
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-0.5 truncate">
                    {o.tableLabel ? `Table ${o.tableLabel}` : o.type} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatPKR(o.total)}
                    {o.originalCashier ? ` · ${o.originalCashier}` : ''}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => setPending({ kind: 'one', order: o, action: 'ADOPT' })}
                    className="h-[38px] px-3 rounded-lg bg-[#0F172A] text-white font-bold text-[12px] hover:bg-[#1E293B] active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Adopt
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setPending({ kind: 'one', order: o, action: 'CANCEL' })}
                    className="h-[38px] px-3 rounded-lg bg-white border border-[#E2E8F0] text-[#B91C1C] font-bold text-[12px] hover:bg-rose-50 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#F8FAFC] border-t border-[#F1F5F9]">
            {busy ? (
              <div className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#475569]">
                <Loader2 size={15} className="animate-spin" />
                Resolving {bulk!.done} of {bulk!.total}…
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPending({ kind: 'all', action: 'ADOPT' })}
                    className="flex-1 h-[40px] rounded-lg bg-[#0F172A] text-white font-bold text-[12px] hover:bg-[#1E293B] active:scale-[0.99] transition-all"
                  >
                    Adopt all {orphans.length}
                  </button>
                  <button
                    onClick={() => setPending({ kind: 'all', action: 'CANCEL' })}
                    className="flex-1 h-[40px] rounded-lg bg-white border border-[#E2E8F0] text-[#B91C1C] font-bold text-[12px] hover:bg-rose-50 active:scale-[0.99] transition-all"
                  >
                    Cancel all {orphans.length}
                  </button>
                </div>
                <p className="text-center text-[11px] text-[#94A3B8] mt-2">
                  One manager PIN applies to the whole batch. You can’t start taking orders until this list is clear.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {pending && (
        <ManagerOverrideModal
          isOpen
          onClose={() => setPending(null)}
          onConfirm={resolve}
          title={
            pending.kind === 'all'
              ? pending.action === 'ADOPT' ? `Adopt all ${orphans.length} orders` : `Cancel all ${orphans.length} orders`
              : pending.action === 'ADOPT' ? 'Adopt Order' : 'Cancel Orphan Order'
          }
          description={
            pending.kind === 'all'
              ? pending.action === 'ADOPT'
                ? `Enter your manager PIN and a reason to move all ${orphans.length} orders into the current shift.`
                : `Enter your manager PIN and a reason to cancel all ${orphans.length} orders. This voids every one.`
              : pending.action === 'ADOPT'
                ? `Enter your manager PIN and a reason to move ${pending.order.orderNumber} into the current shift.`
                : `Enter your manager PIN and a reason to cancel ${pending.order.orderNumber}. This voids the order.`
          }
          reasonLabel="Reason"
          reasonPlaceholder={
            pending.action === 'ADOPT' ? 'e.g. Continuing service from the last shift' : 'e.g. Terminal died mid-service, orders re-taken'
          }
          confirmLabel={
            pending.kind === 'all'
              ? pending.action === 'ADOPT' ? `Adopt ${orphans.length}` : `Cancel ${orphans.length}`
              : pending.action === 'ADOPT' ? 'Adopt Order' : 'Cancel Order'
          }
        />
      )}
    </>
  );
}
