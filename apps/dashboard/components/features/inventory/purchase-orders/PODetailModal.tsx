'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { usePurchaseOrders, usePurchaseOrderDetail, PurchaseOrderSummary } from '../hooks/usePurchaseOrders';
import { POStatusBadge } from './StatusBadge';

interface PODetailModalProps {
  poId: string | null;
  /** The matching list row, used as a fallback for fields PurchaseOrderDetail doesn't carry (date, expectedDate, receivedDate). */
  summary: PurchaseOrderSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onReceive: (id: string) => void;
  onCancelRequest: (id: string) => void;
  sendPO: ReturnType<typeof usePurchaseOrders>['sendPO'];
}

export function PODetailModal({ poId, summary, isOpen, onClose, onEdit, onReceive, onCancelRequest, sendPO }: PODetailModalProps) {
  const { data: detail, isLoading } = usePurchaseOrderDetail(isOpen ? poId : null);

  if (!isOpen || !poId) return null;

  const status = detail?.status ?? summary?.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{detail?.poNumber ?? summary?.poNumber ?? 'Purchase Order'}</h2>
            {status && <div className="mt-1"><POStatusBadge status={status} /></div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
            <Loader2 size={16} className="animate-spin" /> Loading order...
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 border border-slate-100 rounded-lg p-4">
                <InfoField label="Branch" value={detail.branch.name} />
                <InfoField label="Supplier" value={detail.supplier?.name || detail.supplierName || '—'} />
                <InfoField label="Date created" value={summary?.date ? new Date(summary.date).toLocaleDateString() : '—'} />
                <InfoField label="Expected delivery" value={summary?.expectedDate ? new Date(summary.expectedDate).toLocaleDateString() : '—'} />
                <InfoField label="Received on" value={summary?.receivedDate ? new Date(summary.receivedDate).toLocaleDateString() : '—'} />
                <InfoField label="Invoice number" value={detail.invoiceNumber || '—'} />
              </div>

              {detail.notes && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3">{detail.notes}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Line Items</p>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Ingredient</th>
                          <th className="px-3 py-2">Ordered</th>
                          <th className="px-3 py-2">Received</th>
                          <th className="px-3 py-2">Est. Cost</th>
                          <th className="px-3 py-2">Actual Cost</th>
                          <th className="px-3 py-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2 text-xs font-medium text-slate-700">{l.ingredient.name}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.orderedQty} {l.unit || l.ingredient.unit}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.receivedQty} {l.unit || l.ingredient.unit}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">PKR {l.estimatedUnitCost.toLocaleString()}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{l.actualUnitCost != null ? `PKR ${l.actualUnitCost.toLocaleString()}` : '—'}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-800 text-right">
                              {l.lineTotal != null ? `PKR ${l.lineTotal.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-8 px-1">
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider">Estimated total</p>
                  <p className="text-sm font-bold text-slate-700">PKR {detail.estimatedTotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider">Actual total</p>
                  <p className="text-sm font-bold text-slate-900">{detail.totalActual != null ? `PKR ${detail.totalActual.toLocaleString()}` : '—'}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" onClick={onClose}>
                Close
              </button>
              {detail.status === 'DRAFT' && (
                <>
                  <button
                    type="button"
                    onClick={() => onCancelRequest(detail.id)}
                    className="px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel Order
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(detail.id)}
                    className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={sendPO.isPending}
                    onClick={() => sendPO.mutate(detail.id, { onSuccess: onClose })}
                    className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {sendPO.isPending ? 'Sending...' : 'Send to Supplier'}
                  </button>
                </>
              )}
              {(detail.status === 'SENT' || detail.status === 'PARTIALLY_RECEIVED') && (
                <>
                  <button
                    type="button"
                    onClick={() => onCancelRequest(detail.id)}
                    className="px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel Order
                  </button>
                  <button
                    type="button"
                    onClick={() => onReceive(detail.id)}
                    className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors"
                  >
                    Receive Goods
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}
