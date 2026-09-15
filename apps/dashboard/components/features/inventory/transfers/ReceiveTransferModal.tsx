'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useTransfers, useTransferDetail } from '../hooks/useTransfers';

interface ReceiveLine {
  ingredientId: string;
  name: string;
  unit: string;
  dispatchedQty: number;
  alreadyReceived: number;
  receivedQty: number;
}

interface ReceiveTransferModalProps {
  transferId: string | null;
  isOpen: boolean;
  onClose: () => void;
  receiveTransfer: ReturnType<typeof useTransfers>['receiveTransfer'];
}

export function ReceiveTransferModal({ transferId, isOpen, onClose, receiveTransfer }: ReceiveTransferModalProps) {
  const { data: detail, isLoading } = useTransferDetail(isOpen ? transferId : null);

  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const initKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initKey.current = null;
      return;
    }
    if (initKey.current === transferId) return;
    if (!detail) return;

    setLines(
      detail.lines.map((l) => {
        const dispatched = l.dispatchedQty ?? l.requestedQty;
        const already = l.receivedQty || 0;
        return {
          ingredientId: l.ingredientId,
          name: l.ingredient.name,
          unit: l.unit || l.ingredient.unit,
          dispatchedQty: dispatched,
          alreadyReceived: already,
          receivedQty: Math.max(0, dispatched - already),
        };
      })
    );
    initKey.current = transferId;
  }, [isOpen, transferId, detail]);

  if (!isOpen || !transferId) return null;

  const updateLine = (index: number, receivedQty: number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, receivedQty } : l)));
  };

  const handleSubmit = () => {
    // Always send every line explicitly — the backend treats an omitted line as
    // "receiving 0 this round," not "receive whatever's left."
    receiveTransfer.mutate(
      { id: transferId, data: { lines: lines.map((l) => ({ ingredientId: l.ingredientId, receivedQty: l.receivedQty || 0 })) } },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Receive Transfer</h2>
            <p className="text-[13px] text-slate-500">
              {detail ? `${detail.transferNumber} · ${detail.fromBranch.name} → ${detail.toBranch.name}` : 'Loading...'}
            </p>
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
              {receiveTransfer.error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {(receiveTransfer.error as any).message}
                </div>
              )}

              {detail.status === 'PARTIALLY_RECEIVED' && (
                <div className="bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  Some items on this transfer were already received in a previous round — quantities below default to what's still outstanding.
                </div>
              )}

              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2">Dispatched</th>
                        <th className="px-3 py-2 w-28">Receiving Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((l, i) => (
                        <tr key={l.ingredientId}>
                          <td className="px-3 py-2">
                            <p className="text-xs font-medium text-slate-700">{l.name}</p>
                            {l.alreadyReceived > 0 && (
                              <p className="text-[10px] text-slate-400">{l.alreadyReceived} {l.unit} already received</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{l.dispatchedQty} {l.unit}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="any" value={l.receivedQty}
                              onChange={(e) => updateLine(i, Number(e.target.value))}
                              className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                disabled={receiveTransfer.isPending}
                onClick={handleSubmit}
                className="px-5 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {receiveTransfer.isPending ? 'Saving...' : 'Confirm Receipt'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
