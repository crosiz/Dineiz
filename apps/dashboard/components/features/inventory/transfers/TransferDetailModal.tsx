'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTransferDetail } from '../hooks/useTransfers';
import { TransferStatusBadge } from './StatusBadge';

interface TransferDetailModalProps {
  transferId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (id: string) => void;
  onReceive: (id: string) => void;
  onCancelRequest: (id: string) => void;
}

export function TransferDetailModal({ transferId, isOpen, onClose, onDispatch, onReceive, onCancelRequest }: TransferDetailModalProps) {
  const { data: detail, isLoading } = useTransferDetail(isOpen ? transferId : null);

  if (!isOpen || !transferId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{detail?.transferNumber ?? 'Stock Transfer'}</h2>
            {detail && <div className="mt-1"><TransferStatusBadge status={detail.status} /></div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
            <Loader2 size={16} className="animate-spin" /> Loading transfer...
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 border border-slate-100 rounded-lg p-4">
                <InfoField label="From Branch" value={detail.fromBranch.name} />
                <InfoField label="To Branch" value={detail.toBranch.name} />
                <InfoField label="Requested By" value={detail.requestedByName} />
                <InfoField label="Date created" value={new Date(detail.createdAt).toLocaleDateString()} />
                <InfoField label="Dispatched on" value={detail.dispatchedAt ? new Date(detail.dispatchedAt).toLocaleDateString() : '—'} />
                <InfoField label="Received on" value={detail.receivedAt ? new Date(detail.receivedAt).toLocaleDateString() : '—'} />
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
                          <th className="px-3 py-2">Requested</th>
                          <th className="px-3 py-2">Dispatched</th>
                          <th className="px-3 py-2 text-right">Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2 text-xs font-medium text-slate-700">{l.ingredient.name}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.requestedQty} {l.unit || l.ingredient.unit}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.dispatchedQty != null ? `${l.dispatchedQty} ${l.unit || l.ingredient.unit}` : '—'}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-800 text-right">
                              {l.receivedQty != null ? `${l.receivedQty} ${l.unit || l.ingredient.unit}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" onClick={onClose}>
                Close
              </button>
              {detail.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => onCancelRequest(detail.id)}
                    className="px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => onDispatch(detail.id)}
                    className="px-5 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-primary/90 transition-colors"
                  >
                    Dispatch
                  </button>
                </>
              )}
              {(detail.status === 'IN_TRANSIT' || detail.status === 'PARTIALLY_RECEIVED') && (
                <button
                  type="button"
                  onClick={() => onReceive(detail.id)}
                  className="px-5 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-primary/90 transition-colors"
                >
                  Receive
                </button>
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
