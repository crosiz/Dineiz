'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useTransfers, useTransferDetail, useBranchIngredientStock } from '../hooks/useTransfers';

interface DispatchModalProps {
  transferId: string | null;
  isOpen: boolean;
  onClose: () => void;
  dispatchTransfer: ReturnType<typeof useTransfers>['dispatchTransfer'];
}

export function DispatchModal({ transferId, isOpen, onClose, dispatchTransfer }: DispatchModalProps) {
  const { data: detail, isLoading } = useTransferDetail(isOpen ? transferId : null);
  // Live stock at the source branch — fetched separately so it stays accurate even if it
  // resolves after the transfer detail (the qty inputs below don't wait on it to initialize).
  const { data: stockList = [] } = useBranchIngredientStock(detail?.fromBranchId ?? null);

  const [dispatchQtys, setDispatchQtys] = useState<Record<string, number>>({});
  const initKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initKey.current = null;
      return;
    }
    if (initKey.current === transferId) return;
    if (!detail) return;
    const initial: Record<string, number> = {};
    detail.lines.forEach((l) => { initial[l.ingredientId] = l.requestedQty; });
    setDispatchQtys(initial);
    initKey.current = transferId;
  }, [isOpen, transferId, detail]);

  if (!isOpen || !transferId) return null;

  const stockMap = new Map(stockList.map((s: any) => [s.id, s.inStock ?? 0]));

  const handleSubmit = () => {
    if (!detail) return;
    dispatchTransfer.mutate(
      {
        id: transferId,
        data: { lines: detail.lines.map((l) => ({ ingredientId: l.ingredientId, dispatchedQty: dispatchQtys[l.ingredientId] ?? l.requestedQty })) },
      },
      { onSuccess: onClose }
    );
  };

  const anyOverStock = detail?.lines.some((l) => {
    const available = stockMap.get(l.ingredientId) ?? 0;
    return (dispatchQtys[l.ingredientId] ?? l.requestedQty) > available;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Dispatch Transfer</h2>
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
              {dispatchTransfer.error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {(dispatchTransfer.error as any).message}
                </div>
              )}

              {anyOverStock && (
                <div className="bg-amber-50 text-amber-700 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  One or more quantities exceed current stock at {detail.fromBranch.name}. You can still proceed — stock there will be set to 0 and an anomaly will be logged.
                </div>
              )}

              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2">Requested</th>
                        <th className="px-3 py-2">Available at {detail.fromBranch.name}</th>
                        <th className="px-3 py-2 w-28">Dispatching</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.lines.map((l) => {
                        const available = stockMap.get(l.ingredientId) ?? 0;
                        const qty = dispatchQtys[l.ingredientId] ?? l.requestedQty;
                        const over = qty > available;
                        return (
                          <tr key={l.ingredientId}>
                            <td className="px-3 py-2 text-xs font-medium text-slate-700">{l.ingredient.name}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.requestedQty} {l.unit || l.ingredient.unit}</td>
                            <td className={`px-3 py-2 text-xs font-medium ${over ? 'text-amber-600' : 'text-slate-500'}`}>{available} {l.ingredient.unit}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="any" value={qty}
                                onChange={(e) => setDispatchQtys((prev) => ({ ...prev, [l.ingredientId]: Number(e.target.value) }))}
                                className={`h-8 px-2 rounded border text-xs w-full ${over ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
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
                disabled={dispatchTransfer.isPending}
                onClick={handleSubmit}
                className="px-5 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {dispatchTransfer.isPending ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
