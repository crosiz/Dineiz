'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getToken } from '@/lib/pos-session';
import { useCartStore } from '@/lib/store';
import { formatPKR } from '@/lib/utils';
import { StatusBadge, TicketTimer } from '@/components/OrderStatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { VoidItemBottomSheet } from './order/VoidItemBottomSheet';
import PaymentModal from '@/components/PaymentModal';
import { useViews } from '@/lib/core/views';
import { markReady, sendToKitchen, cancelOrder } from '@/lib/core/commands';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STEPS = ['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED'] as const;

interface OrderDetailsModalProps {
  orderId: string | null;
  onClose: () => void;
  useKDS: boolean;
  readOnly?: boolean;
  onChanged?: () => void;
  /**
   * The order object already sitting in the Tickets/Home list (from
   * /api/orders/live) — has status/type/table/total but not per-item
   * price/addon detail. When provided, the modal paints instantly from this
   * instead of showing a blank spinner while it re-fetches data the screen
   * already had; the full-detail fetch still runs in the background and
   * replaces the item list (with prices/addons) the moment it lands.
   */
  initialOrder?: any;
}

// Adapts the lightweight /api/orders/live shape into a stand-in for the full
// /api/orders/:id detail shape, so the header/status/total can render before
// the detailed fetch returns. Item rows are marked __partial and rendered as
// a loading placeholder rather than real priced lines.
function shellFromSummary(summary: any) {
  // Accepts either the old /api/orders/live summary shape or a
  // lib/core/views.ts OrderView (Phase 2 — Home/Tickets now pass the latter
  // as initialOrder), which uses different field names for the same data.
  return {
    id: summary.id,
    orderNumber: summary.orderNumber,
    tokenNumber: summary.tokenNumber ?? summary.token ?? null,
    status: summary.status,
    type: summary.type,
    createdAt: summary.createdAt,
    table: summary.tableLabel ? { label: summary.tableLabel } : null,
    tableId: summary.tableId ?? null,
    assignedWaiter: summary.assignedWaiterName ? { name: summary.assignedWaiterName } : null,
    netAmount: summary.netAmount ?? summary.total ?? 0,
    totalAmount: summary.netAmount ?? summary.total ?? 0,
    items: [],
    __partial: true,
  };
}

export function OrderDetailsModal({ orderId, onClose, useKDS, readOnly, onChanged, initialOrder }: OrderDetailsModalProps) {
  const router = useRouter();
  const session = useCartStore(s => s.session);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [waiters, setWaiters] = useState<any[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);

  const [voidState, setVoidState] = useState<{ isOpen: boolean; item: any }>({ isOpen: false, item: null });
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelPinOpen, setCancelPinOpen] = useState(false);

  const fetchOrder = async (silent = false) => {
    if (!orderId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Order not found');
      setOrder(await res.json());
    } catch {
      if (!silent) {
        toast.error('Could not load order');
        onClose();
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    if (initialOrder) {
      // Instant paint from data the list screen already had — no spinner —
      // then quietly upgrade to the full-detail response in the background.
      setOrder(shellFromSummary(initialOrder));
      fetchOrder(true);
    } else {
      setOrder(null);
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!assignOpen || !session?.branchId || waiters.length > 0) return;
    fetch(`${API_URL}/api/pos/waiters?branchId=${session.branchId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => setWaiters(data.waiters || data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignOpen]);

  if (!orderId) return null;

  const refreshAfterChange = () => {
    fetchOrder(true);
    onChanged?.();
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    // Local-first: flip the stepper/badge immediately, and — if this order
    // is tracked in the shared view store (lib/core/views.ts, populated for
    // anything created this session or merged in from the server) — update
    // that too, so the ticket card behind this modal shows the same status
    // without waiting on the PUT below. No rollback on failure: the action
    // already happened physically: reverting the screen would just lie to
    // the cashier about what they already did.
    setOrder((prev: any) => (prev ? { ...prev, status } : prev));
    if (status === 'READY') await markReady(orderId!);
    else if (status === 'IN_KITCHEN') await sendToKitchen(orderId!);
    else if (status === 'CANCELLED') await cancelOrder(orderId!);
    onChanged?.();

    const tracked = useViews.getState().orders[orderId!];
    const putId = tracked?.serverId ?? orderId;

    try {
      const res = await fetch(`${API_URL}/api/orders/${putId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(status === 'READY' ? 'Order marked ready' : status === 'IN_KITCHEN' ? 'Sent to kitchen' : status === 'CANCELLED' ? 'Order cancelled' : 'Order updated');
      fetchOrder(true);
    } catch {
      toast.error('Marked locally, but the server hasn’t confirmed yet — will retry automatically.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async (waiter: { id: string; name: string } | null) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ waiterId: waiter?.id ?? null, waiterName: waiter?.name ?? null }),
      });
      if (!res.ok) throw new Error();
      toast.success(waiter ? `Assigned to ${waiter.name}` : 'Waiter unassigned');
      setAssignOpen(false);
      refreshAfterChange();
    } catch {
      toast.error('Failed to assign waiter');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddItem = () => {
    const typeStr = order.type ? order.type.toLowerCase().replace('_', '-') : 'dine-in';
    router.push(`/pos/order?orderId=${order.id}&edit=true&tableId=${order.tableId ?? ''}&tableLabel=${order.table?.label ?? ''}&type=${typeStr}`);
    onClose();
  };

  const handleReprintKOT = async () => {
    try {
      const { printDocument } = await import('@/lib/print.service');
      await printDocument('KOT', {
        orderNumber: order.orderNumber,
        tokenNumber: order.tokenNumber || order.orderNumber,
        type: order.type,
        tableLabel: order.table?.label,
        cashierName: session.cashierName,
        createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        items: order.items.map((it: any) => ({
          name: it.item?.name || 'Item',
          quantity: it.quantity,
          variationName: it.options?.variation?.name,
          addOnNames: (it.options?.addOns || []).map((a: any) => (a.price ? `${a.name} (+${a.price})` : a.name)),
          notes: it.notes,
        })),
      } as any);
      toast.success('KOT reprinted');
    } catch {
      toast.error('Failed to reprint KOT');
    }
  };

  const voidRequiresManagerApproval = (session as any)?.tenantBranding?.voidRequiresManagerApproval ?? true;
  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';

  const requestCancel = () => setCancelConfirmOpen(true);
  const confirmCancel = () => {
    setCancelConfirmOpen(false);
    if (voidRequiresManagerApproval && !isManager) {
      setCancelPinOpen(true);
    } else {
      updateStatus('CANCELLED');
    }
  };

  const status = order?.status;
  const isPending = status === 'PENDING';
  const isInKitchen = status === 'IN_KITCHEN';
  const isReady = status === 'READY';
  const isFinal = status === 'COMPLETED' || status === 'CANCELLED';
  const canAct = !readOnly && !isFinal;
  // Guards status/payment/cancel actions during the brief window where only
  // the instant-paint shell (no priced items yet) has landed — Add
  // Item/Assign/KOT stay clickable since they don't depend on item pricing.
  const busy = order?.__partial || isUpdating;

  const netAmount = order ? Number(order.netAmount ?? order.totalAmount ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-[560px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 max-h-[92vh] flex flex-col">
        {!order ? (
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined animate-spin text-[#94A3B8] text-3xl">progress_activity</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-[#E2E8F0] flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-[20px] font-bold text-[#0F172A] clash-display">#{order.tokenNumber || order.orderNumber}</h2>
                  <StatusBadge status={order.status} />
                  {order.createdAt && !isFinal && <TicketTimer createdAt={order.createdAt} />}
                </div>
                <p className="text-[13px] text-[#64748B] font-medium">
                  {order.type === 'DINE_IN' ? 'Dine-In' : order.type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}
                  {order.table?.label && ` · Table ${order.table.label}`}
                  {order.assignedWaiter?.name && ` · ${order.assignedWaiter.name}`}
                </p>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] text-[#64748B]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Status stepper */}
            {!isFinal || status === 'COMPLETED' ? (
              <div className="px-5 pt-4 flex items-center shrink-0">
                {STEPS.map((step, i) => {
                  const stepIndex = STEPS.indexOf(status);
                  const done = i <= stepIndex;
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? 'bg-[var(--pos-primary)]' : 'bg-[#E2E8F0]'}`} />
                      {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < stepIndex ? 'bg-[var(--pos-primary)]' : 'bg-[#E2E8F0]'}`} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 pt-4 shrink-0">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">cancel</span> Order Cancelled
                </div>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {order.__partial ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-[#F1F5F9] rounded-lg" />
                  ))}
                </div>
              ) : order.items.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0F172A] text-[14px]">{item.quantity}x {item.item?.name || 'Item'}</p>
                    {item.options?.variation?.name && (
                      <p className="text-[12px] text-[#64748B]">{item.options.variation.name}</p>
                    )}
                    {item.options?.addOns?.length > 0 && (
                      <p className="text-[12px] text-[#64748B]">
                        {item.options.addOns.map((a: any) => a.price ? `+${a.name} (${formatPKR(a.price)})` : `+${a.name}`).join(', ')}
                      </p>
                    )}
                    {item.notes && <p className="text-[12px] text-[#94A3B8] italic">"{item.notes}"</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-[#0F172A] text-[14px]">{formatPKR(item.subtotal)}</span>
                    {canAct && (
                      <button
                        onClick={() => setVoidState({ isOpen: true, item: { ...item, orderId: order.id, itemName: item.item?.name } })}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-rose-500"
                        title="Remove item"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F8FAFC]">
              <span className="text-[13px] font-bold text-[#64748B] uppercase tracking-wide">Total</span>
              <span className="text-[20px] font-bold text-[#0F172A] clash-display">{formatPKR(netAmount)}</span>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[#E2E8F0] shrink-0 space-y-2">
              {canAct && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={handleAddItem} className="h-11 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] font-bold text-[12px] flex flex-col items-center justify-center gap-0.5 hover:bg-[#F1F5F9] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span> Add Item
                  </button>
                  <button onClick={() => setAssignOpen(true)} className="h-11 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] font-bold text-[12px] flex flex-col items-center justify-center gap-0.5 hover:bg-[#F1F5F9] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">person_add</span> Waiter
                  </button>
                  <button onClick={handleReprintKOT} className="h-11 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] font-bold text-[12px] flex flex-col items-center justify-center gap-0.5 hover:bg-[#F1F5F9] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span> KOT
                  </button>
                </div>
              )}

              {canAct && (
                <div className="flex gap-2">
                  <button
                    onClick={requestCancel}
                    disabled={busy}
                    className="h-12 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 font-bold text-[13px] hover:bg-rose-100 transition-colors disabled:opacity-50"
                  >
                    Cancel Order
                  </button>

                  {isReady ? (
                    <button
                      onClick={() => setIsPaymentOpen(true)}
                      disabled={busy}
                      className="flex-1 h-12 rounded-xl font-bold text-white text-[14px] shadow-sm transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--pos-primary)' }}
                    >
                      {order.__partial ? 'Loading order…' : 'Collect Payment'}
                    </button>
                  ) : isPending ? (
                    <button
                      onClick={() => updateStatus(useKDS ? 'IN_KITCHEN' : 'READY')}
                      disabled={busy}
                      className="flex-1 h-12 rounded-xl font-bold text-white text-[14px] shadow-sm transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--pos-primary)' }}
                    >
                      {useKDS ? 'Send to Kitchen' : 'Mark Ready'}
                    </button>
                  ) : isInKitchen ? (
                    useKDS ? (
                      <button disabled className="flex-1 h-12 rounded-xl font-bold text-[#94A3B8] text-[14px] bg-[#F1F5F9] cursor-not-allowed">
                        In Kitchen (KDS)…
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus('READY')}
                        disabled={busy}
                        className="flex-1 h-12 rounded-xl font-bold text-white text-[14px] shadow-sm transition-all disabled:opacity-50"
                        style={{ backgroundColor: 'var(--pos-primary)' }}
                      >
                        Mark Ready
                      </button>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Assign waiter sheet */}
      {assignOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAssignOpen(false)} />
          <div className="relative w-full sm:max-w-[360px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl p-5 max-h-[70vh] overflow-y-auto">
            <h3 className="font-bold text-[16px] text-[#0F172A] mb-4">Assign Waiter</h3>
            <div className="space-y-1.5">
              <button onClick={() => handleAssign(null)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] font-medium text-[14px]">
                Unassigned
              </button>
              {waiters.map((w: any) => (
                <button key={w.id} onClick={() => handleAssign(w)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] text-[#0F172A] font-bold text-[14px]">
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {voidState.isOpen && (
        <VoidItemBottomSheet
          isOpen={voidState.isOpen}
          item={voidState.item}
          onClose={() => setVoidState({ isOpen: false, item: null })}
          onSuccess={() => { setVoidState({ isOpen: false, item: null }); refreshAfterChange(); }}
          voidRequiresManagerApproval={voidRequiresManagerApproval}
        />
      )}

      {isPaymentOpen && order && (
        <PaymentModal
          isOpen={isPaymentOpen}
          orderId={order.id}
          orderNumber={order.orderNumber}
          orderTotal={netAmount}
          orderItems={order.items.map((i: any) => `${i.quantity}x ${i.item?.name || 'Item'}`).join(' · ')}
          items={order.items}
          tableLabel={order.table?.label}
          tableId={order.tableId ?? undefined}
          customerId={order.customerId ?? null}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={() => { setIsPaymentOpen(false); refreshAfterChange(); onClose(); }}
        />
      )}

      <ConfirmModal
        isOpen={cancelConfirmOpen}
        title="Cancel this order?"
        message="This will cancel the entire order and cannot be undone."
        confirmText="Cancel Order"
        cancelText="Keep Order"
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setCancelConfirmOpen(false)}
      />

      {cancelPinOpen && (
        <AdminPinModal
          onClose={() => setCancelPinOpen(false)}
          onSuccess={() => { setCancelPinOpen(false); updateStatus('CANCELLED'); }}
        />
      )}
    </div>
  );
}
