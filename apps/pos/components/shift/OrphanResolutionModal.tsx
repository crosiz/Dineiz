'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPKR } from '@/lib/utils';
import { ManagerOverrideModal } from '../ManagerOverrideModal';
import { Dialog, DialogButton } from '../ui/Dialog';
import { OrderTypeBadge, StatusBadge } from '../OrderStatusBadge';
import { API_URL } from '@/lib/api';


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
  originalCashierId: string | null;
}

interface Props {
  orphans: OrphanOrder[];
  branchId: string;
  intoShiftId: string;
  token: string | null;
  /** The signed-in user resolving this list — lets self-owned orders skip the manager PIN below. */
  currentUserId: string;
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
export function OrphanResolutionModal({ orphans, intoShiftId, token, currentUserId, onResolved }: Props) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [selfBusyId, setSelfBusyId] = useState<string | null>(null);

  if (orphans.length === 0) return null;

  const isSelfOwned = (o: OrphanOrder) => !!o.originalCashierId && o.originalCashierId === currentUserId;

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resolveOne = async (order: OrphanOrder, action: 'ADOPT' | 'CANCEL', pin?: string, reason?: string) => {
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

  // Adopting your OWN order into your OWN new shift needs no manager PIN —
  // the server enforces the same rule (order.cashierId === the caller), this
  // just skips showing a PIN pad for a "no" the server would never actually
  // give here.
  const adoptSelf = async (order: OrphanOrder) => {
    setSelfBusyId(order.id);
    try {
      await resolveOne(order, 'ADOPT');
      toast.success(`${order.orderNumber} continued into this shift`);
      onResolved();
    } catch (e: any) {
      toast.error(e.message || `Could not adopt ${order.orderNumber}`);
    } finally {
      setSelfBusyId(null);
    }
  };

  const adoptAllSelf = async () => {
    setBulk({ done: 0, total: orphans.length });
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < orphans.length; i++) {
      try {
        await resolveOne(orphans[i], 'ADOPT');
        ok++;
      } catch (e: any) {
        failures.push(orphans[i].orderNumber);
      }
      setBulk({ done: i + 1, total: orphans.length });
    }
    setBulk(null);
    if (ok > 0) toast.success(`${ok} order${ok === 1 ? '' : 's'} continued into this shift`);
    if (failures.length) toast.error(`${failures.length} could not be resolved — ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`);
    onResolved();
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

  const busy = bulk !== null || selfBusyId !== null;
  const total = orphans.reduce((s, o) => s + (o.total || 0), 0);
  const allSelfOwned = orphans.every(isSelfOwned);

  return (
    <>
      {/* Not dismissible: orders can't be taken until this list is clear.
          On the shared Dialog; bulk actions only appear when there is more
          than one order, which is what produced "Adopt all 1 orders". */}
      <Dialog
        onClose={() => {}}
        dismissible={false}
        z={200}
        size="md"
        icon={AlertTriangle}
        tone="warn"
        title={`${orphans.length === 1 ? 'An order' : `${orphans.length} orders`} from an earlier shift ${orphans.length === 1 ? 'is' : 'are'} still open`}
        description={
          allSelfOwned
            ? 'They’re your own. Continue them in this shift, or void them (voiding needs a manager PIN).'
            : 'Take them into this shift, or void them. Either needs a manager PIN; one PIN covers the whole batch.'
        }
        footer={
          bulk !== null ? (
            <div className="w-full flex items-center justify-center gap-2 h-11 text-[13px] font-medium text-ink-2">
              <Loader2 size={16} className="animate-spin" />
              Resolving {bulk.done} of {bulk.total}…
            </div>
          ) : (
            <div className="w-full">
              {orphans.length > 1 && (
                <div className="flex gap-2.5 mb-2.5">
                  <DialogButton variant="danger" disabled={busy} onClick={() => setPending({ kind: 'all', action: 'CANCEL' })}>
                    Void all {orphans.length}
                  </DialogButton>
                  <DialogButton variant="ink" disabled={busy} onClick={() => (allSelfOwned ? adoptAllSelf() : setPending({ kind: 'all', action: 'ADOPT' }))}>
                    {allSelfOwned ? `Continue all ${orphans.length}` : `Adopt all ${orphans.length}`}
                  </DialogButton>
                </div>
              )}
              <p className="text-center text-[12.5px] text-ink-3">
                {formatPKR(total)} across {orphans.length === 1 ? '1 order' : `${orphans.length} orders`}. New orders open once this list is clear.
              </p>
            </div>
          )
        }
      >
        <ul className="border border-line rounded-xl divide-y divide-line overflow-hidden">
          {orphans.map((o) => (
            <li key={o.id} className="px-3.5 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] font-semibold text-ink tabular-nums whitespace-nowrap">#{o.orderNumber}</span>
                  <OrderTypeBadge type={o.type} tableLabel={o.tableLabel} size="sm" />
                  <StatusBadge status={o.status} className="hidden sm:inline-flex" />
                </div>
                <p className="mt-0.5 text-[12.5px] text-ink-3 truncate">
                  {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatPKR(o.total)}
                  {o.originalCashier ? ` · ${o.originalCashier}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={busy}
                  onClick={() => setPending({ kind: 'one', order: o, action: 'CANCEL' })}
                  className="h-9 px-3 rounded-lg border border-line text-[13px] font-semibold text-danger hover:bg-danger/10 hover:border-danger/30 disabled:opacity-40"
                >
                  Void
                </button>
                <button
                  disabled={busy}
                  onClick={() => (isSelfOwned(o) ? adoptSelf(o) : setPending({ kind: 'one', order: o, action: 'ADOPT' }))}
                  className="h-9 px-3.5 rounded-lg bg-ink text-white text-[13px] font-semibold hover:bg-ink-2 disabled:opacity-40"
                >
                  {selfBusyId === o.id ? 'Working…' : isSelfOwned(o) ? 'Continue' : 'Adopt'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Dialog>

      {pending && (
        <ManagerOverrideModal
          isOpen
          onClose={() => setPending(null)}
          onConfirm={resolve}
          title={
            pending.kind === 'all'
              ? `${pending.action === 'ADOPT' ? 'Adopt' : 'Cancel'} ${orphans.length === 1 ? '1 order' : `all ${orphans.length} orders`}`
              : `${pending.action === 'ADOPT' ? 'Adopt' : 'Cancel'} order ${pending.order.orderNumber}`
          }
          description={
            pending.action === 'ADOPT'
              ? `${pending.kind === 'all' ? (orphans.length === 1 ? 'It moves' : 'They move') : 'It moves'} into the current shift and counts toward it from now on.`
              : `${pending.kind === 'all' && orphans.length > 1 ? 'Every one is voided' : 'The order is voided'}. This can’t be undone.`
          }
          reasonLabel="Reason"
          reasonPlaceholder={
            pending.action === 'ADOPT' ? 'e.g. Continuing service from the last shift' : 'e.g. Terminal died mid-service, orders re-taken'
          }
          confirmLabel={
            pending.kind === 'all'
              ? `${pending.action === 'ADOPT' ? 'Adopt' : 'Cancel'} ${orphans.length === 1 ? 'order' : orphans.length}`
              : pending.action === 'ADOPT' ? 'Adopt order' : 'Cancel order'
          }
        />
      )}
    </>
  );
}
