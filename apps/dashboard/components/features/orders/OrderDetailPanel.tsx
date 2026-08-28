'use client';
import { formatPKR } from '@/lib/formatters';
import React, { useState } from 'react';
import { X, User, UtensilsCrossed, CreditCard, Printer, Receipt, Undo2, ChevronDown, CheckCircle2, ChevronRight, Maximize2, FileText, Plus } from 'lucide-react';
import { Skeleton, SkeletonDetail } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { toast } from 'sonner';
import { ReceiptPreview } from './ReceiptPreview';

// Printing/PDF export from the admin dashboard needs a real print/PDF
// pipeline that doesn't exist yet (the POS terminal has one, scoped to its
// own attached printer — the dashboard isn't near a printer at all). Until
// that's built, these actions say so honestly instead of doing nothing.
const notImplemented = () => toast.info('Printing from the dashboard is coming soon — use the POS terminal for now');

interface OrderDetailPanelProps {
  orderId: string;
  onClose: () => void;
  onReverse: (id: string) => Promise<void>;
}

const STATUS_OPTIONS = ['PENDING', 'IN_KITCHEN', 'READY', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatus = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_KITCHEN: 'bg-blue-100 text-blue-700 border-blue-200',
  READY: 'bg-green-100 text-green-700 border-green-200',
  DELIVERED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  IN_KITCHEN: 'In Kitchen',
  DELIVERED: 'Completed',
  COMPLETED: 'Completed',
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

function AuditTrailSection({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  
  const trail = [];
  if (order.createdAt) trail.push({ time: order.createdAt, actor: order.shift?.user?.name || 'System', action: 'Order Created', detail: 'Initial creation' });
  if (order.assignedAt) trail.push({ time: order.assignedAt, actor: 'Manager', action: 'Assigned Waiter', detail: `Assigned to ${order.assignedWaiterName || 'staff'}` });
  
  order.payments?.forEach((p: any) => 
    trail.push({ time: p.createdAt || order.createdAt, actor: 'Cashier', action: 'Payment Collected', detail: `Amount: ${p.amount} via ${p.method}` })
  );
  
  order.VoidRequest?.forEach((v: any) => 
    trail.push({ time: v.createdAt, actor: 'Staff', action: `Void Request ${v.status}`, detail: `Qty: ${v.quantity} - Reason: ${v.reason}` })
  );

  if (order.updatedAt && ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
    trail.push({ time: order.updatedAt, actor: 'System', action: `Status Changed`, detail: `Order marked as ${order.status}` });
  }

  trail.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <FileText size={14} /> Audit Trail
        </h3>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-4 bg-white space-y-4">
          <div className="relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 space-y-4">
            {trail.map((evt, i) => (
              <div key={i} className="relative flex items-start gap-4 pl-8">
                <div className="absolute left-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center z-10 shrink-0 border border-slate-200">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{evt.action}</p>
                  <p className="text-xs text-slate-500">
                    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(evt.time))} · By {evt.actor}
                  </p>
                  <p className="text-xs text-slate-400 italic mt-0.5">{evt.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KOTHistorySection({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Printer size={14} /> KOT History
        </h3>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div>
              <p className="text-sm font-bold text-slate-900">Initial KOT</p>
              <p className="text-xs text-slate-500">{fmtDateTime(order.createdAt)}</p>
            </div>
            <button onClick={notImplemented} className="text-xs font-bold text-[#ff5722] hover:underline">Download PDF</button>
          </div>
          {order.VoidRequest?.length > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-bold text-slate-900">Cancellation KOT</p>
                <p className="text-xs text-slate-500">{fmtDateTime(order.VoidRequest[0].createdAt)}</p>
              </div>
              <button onClick={notImplemented} className="text-xs font-bold text-[#ff5722] hover:underline">Download PDF</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPanel({ orderId, onClose, onReverse }: OrderDetailPanelProps) {
  const qc = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [receiptType, setReceiptType] = useState<'CUSTOMER_BILL' | 'PAID_RECEIPT'>('CUSTOMER_BILL');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => apiFetch<any>(`/api/orders/${orderId}`),
    staleTime: 10_000,
  });

  const changeStatus = async (newStatus: OrderStatus) => {
    setUpdatingStatus(true);
    setStatusOpen(false);
    try {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      qc.invalidateQueries({ queryKey: ['order-detail', orderId] });
      qc.invalidateQueries({ queryKey: ['order-history'] });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReverse = async () => {
    setIsReversing(true);
    try { await onReverse(orderId); onClose(); }
    catch { setIsReversing(false); setShowConfirm(false); }
  };

  // Switch default receipt type if order is completed
  React.useEffect(() => {
    if (order && ['COMPLETED', 'DELIVERED'].includes(order.status)) {
      setReceiptType('PAID_RECEIPT');
    }
  }, [order?.status]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 backdrop-blur-[2px] flex justify-end" onClick={onClose}>
      <div
        className="w-[680px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex-1 flex flex-col" role="status" aria-busy="true">
            <span className="sr-only">Loading order</span>
            <div className="p-6 border-b border-slate-100 shrink-0 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="px-6 py-4 border-b border-slate-100 flex gap-2 shrink-0">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SkeletonDetail sections={3} />
            </div>
          </div>
        ) : !order ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">Order not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 shrink-0 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[22px] font-bold text-slate-900">#{order.orderNumber}</h2>
                  <div className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold uppercase tracking-tight ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </div>
                  <div className="px-2.5 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-bold uppercase tracking-tight">
                    {order.source}
                  </div>
                </div>
                <Link href={`/dashboard/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm text-[#ff5722] hover:underline font-semibold mt-1">
                  Open in full page <Maximize2 size={12} />
                </Link>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Action Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 bg-white">
              {!['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                <button onClick={notImplemented} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Receipt size={15} /> Print Bill
                </button>
              )}
              {['COMPLETED', 'DELIVERED'].includes(order.status) && (
                <button onClick={notImplemented} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Receipt size={15} /> Print Receipt
                </button>
              )}
              <button onClick={notImplemented} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Printer size={15} /> Reprint KOT
              </button>
              {!['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                <button onClick={() => toast.info('Adding items from the dashboard is coming soon — use the POS terminal for now')} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Plus size={15} /> Add Items
                </button>
              )}
              {!['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                <button onClick={() => setShowConfirm(true)} className="flex items-center gap-2 px-3 py-1.5 border border-red-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 ml-auto">
                  <Undo2 size={15} /> Void Order
                </button>
              )}
            </div>

            {showConfirm && (
              <div className="bg-red-50 border-b border-red-200 p-4 px-6 flex items-center justify-between shrink-0">
                <p className="text-sm font-bold text-red-800">Are you sure you want to void this order?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirm(false)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Keep</button>
                  <button onClick={handleReverse} disabled={isReversing} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                    {isReversing ? 'Voiding...' : 'Confirm Void'}
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
              <div className="p-6 space-y-6 max-w-full">
                
                {/* ORDER INFO */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Order Info</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Date & Time</p>
                      <p className="font-semibold text-slate-900">{fmtDateTime(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Duration</p>
                      <p className="font-semibold text-slate-900">
                        {order.status === 'COMPLETED' ? `${Math.round((new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 60000)} mins` : 'In Progress'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Order Type</p>
                      <p className="font-semibold text-slate-900 capitalize">
                        {order.type.replace('_', ' ')} {order.table?.label ? `- T${order.table.label}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Cashier</p>
                      <p className="font-semibold text-slate-900">{order.shift?.user?.name || 'System'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Waiter</p>
                      <p className="font-semibold text-slate-900">{order.assignedWaiterName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Customer</p>
                      {order.customer ? (
                        <Link href={`/dashboard/customers?customerId=${order.customer.id}`} className="font-semibold text-[#ff5722] hover:underline">
                          {order.customer.name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-slate-900">Guest</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ITEMS */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Items ({order.items?.length ?? 0})</h3>
                  <div className="w-full">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-2 font-medium">Item Name</th>
                          <th className="pb-2 font-medium text-center">Qty</th>
                          <th className="pb-2 font-medium text-right">Price</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items?.map((item: any, i: number) => {
                          const isVoided = order.VoidRequest?.some((v: any) => v.orderItemId === item.id && v.status === 'APPROVED');
                          
                          return (
                            <tr key={i} className="border-b border-slate-100 last:border-0 group">
                              <td className="py-3">
                                <div className="flex items-start gap-2">
                                  <div>
                                    <p className={`font-semibold text-slate-900 ${isVoided ? 'line-through text-slate-400' : ''}`}>
                                      {item.item?.name ?? item.name ?? 'Item'}
                                    </p>
                                    {item.variationName && <p className="text-xs text-slate-500">{item.variationName}</p>}
                                    {item.notes && <p className="text-xs italic text-slate-400 mt-0.5">{item.notes}</p>}
                                    {isVoided && <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Voided</span>}
                                  </div>
                                </div>
                              </td>
                              <td className={`py-3 text-center font-bold ${isVoided ? 'text-slate-400' : 'text-slate-700'}`}>{item.quantity}</td>
                              <td className={`py-3 text-right ${isVoided ? 'text-slate-400' : 'text-slate-600'}`}>{formatPKR(item.unitPrice)}</td>
                              <td className={`py-3 text-right font-bold ${isVoided ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatPKR(item.subtotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {order.notes && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Order Note</p>
                      <p className="text-sm text-amber-900">{order.notes}</p>
                    </div>
                  )}
                </div>

                {/* FINANCIALS & RECEIPT GRID */}
                <div className="grid grid-cols-2 gap-6">
                  {/* FINANCIALS */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Financials</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span className="tabular-nums font-semibold">{formatPKR(order.totalAmount || 0)}</span>
                      </div>
                      {(order.discountAmount || 0) > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Discount</span>
                          <span className="tabular-nums font-semibold">−{formatPKR(order.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Tax</span>
                        <span className="tabular-nums font-semibold">{formatPKR(order.taxAmount || 0)}</span>
                      </div>
                      <div className="h-px bg-slate-200 my-2" />
                      <div className="flex justify-between text-lg font-black text-slate-900">
                        <span>Total</span>
                        <span className="tabular-nums">{formatPKR(order.netAmount || 0)}</span>
                      </div>

                      {order.payments?.map((p: any, i: number) => (
                        <div key={i} className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Paid via {p.method}</p>
                          <div className="flex justify-between font-bold text-slate-900 text-sm">
                            <span>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(p.createdAt || order.createdAt))}</span>
                            <span>{formatPKR(p.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RECEIPT PREVIEW */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Receipt Preview</h3>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button 
                          onClick={() => setReceiptType('CUSTOMER_BILL')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase transition-colors ${receiptType === 'CUSTOMER_BILL' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Pre-Payment
                        </button>
                        <button 
                          onClick={() => setReceiptType('PAID_RECEIPT')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase transition-colors ${receiptType === 'PAID_RECEIPT' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Post-Payment
                        </button>
                      </div>
                    </div>
                    <ReceiptPreview order={order} type={receiptType} />
                  </div>
                </div>

                <AuditTrailSection order={order} />
                <KOTHistorySection order={order} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
