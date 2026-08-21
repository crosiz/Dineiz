'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { usePurchaseOrders, usePurchaseOrderDetail } from '../hooks/usePurchaseOrders';

interface ReceiveLine {
  ingredientId: string;
  name: string;
  unit: string;
  orderedQty: number;
  alreadyReceived: number;
  estimatedUnitCost: number;
  receivedQty: number;
  actualUnitCost: number;
  updateIngredientCost: boolean;
}

interface CostVarianceWarning {
  ingredientId: string;
  name: string;
  oldCostPerUnit: number;
  newCostPerUnit: number;
  variancePercent: number;
}

interface ReceiveGoodsModalProps {
  poId: string | null;
  isOpen: boolean;
  onClose: () => void;
  receivePO: ReturnType<typeof usePurchaseOrders>['receivePO'];
}

export function ReceiveGoodsModal({ poId, isOpen, onClose, receivePO }: ReceiveGoodsModalProps) {
  const { data: detail, isLoading } = usePurchaseOrderDetail(isOpen ? poId : null);

  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [warnings, setWarnings] = useState<CostVarianceWarning[] | null>(null);

  const initKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initKey.current = null;
      setWarnings(null);
      return;
    }
    if (initKey.current === poId) return;
    if (!detail) return;

    setLines(
      detail.lines.map((l) => {
        const remaining = Math.max(0, l.orderedQty - l.receivedQty);
        return {
          ingredientId: l.ingredientId,
          name: l.ingredient.name,
          unit: l.unit || l.ingredient.purchaseUnit || l.ingredient.unit,
          orderedQty: l.orderedQty,
          alreadyReceived: l.receivedQty,
          estimatedUnitCost: l.estimatedUnitCost,
          receivedQty: remaining,
          actualUnitCost: l.estimatedUnitCost,
          updateIngredientCost: false,
        };
      })
    );
    setInvoiceNumber(detail.invoiceNumber ?? '');
    setNotes('');
    setWarnings(null);
    initKey.current = poId;
  }, [isOpen, poId, detail]);

  if (!isOpen || !poId) return null;

  const updateLine = (index: number, patch: Partial<ReceiveLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = () => {
    const payload = {
      lines: lines.map((l) => ({
        ingredientId: l.ingredientId,
        receivedQty: l.receivedQty || 0,
        actualUnitCost: l.actualUnitCost,
        updateIngredientCost: l.updateIngredientCost,
      })),
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    receivePO.mutate(
      { id: poId, data: payload },
      {
        onSuccess: (res: any) => {
          if (res?.costVarianceWarnings?.length) {
            // Surface variance detail in-modal before closing — the hook's toast only shows a count.
            setWarnings(res.costVarianceWarnings);
          } else {
            handleClose();
          }
        },
      }
    );
  };

  const total = lines.reduce((sum, l) => sum + (l.receivedQty || 0) * (l.actualUnitCost || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose}></div>

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Receive Goods</h2>
            <p className="text-[13px] text-slate-500">{detail?.poNumber ?? 'Loading...'}</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
            <Loader2 size={16} className="animate-spin" /> Loading order...
          </div>
        ) : warnings ? (
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Received — with a cost variance</h3>
                <p className="text-[13px] text-slate-500">{warnings.length} ingredient(s) had an actual cost more than 5% off their current master cost.</p>
              </div>
            </div>
            <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Ingredient</span><span>Old Cost</span><span>New Cost</span><span>Variance</span>
              </div>
              {warnings.map((w) => (
                <div key={w.ingredientId} className="grid grid-cols-4 gap-2 px-3 py-2 items-center">
                  <span className="text-xs font-medium text-slate-700">{w.name}</span>
                  <span className="text-xs text-slate-600">PKR {w.oldCostPerUnit.toLocaleString()}</span>
                  <span className="text-xs text-slate-600">PKR {w.newCostPerUnit.toLocaleString()}</span>
                  <span className={`text-xs font-bold ${w.variancePercent > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {w.variancePercent > 0 ? '+' : ''}{w.variancePercent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">Lines where you ticked "update ingredient cost" now use the new cost as their master cost going forward.</p>
            <div className="flex justify-end pt-2">
              <button onClick={handleClose} className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {receivePO.error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {(receivePO.error as any).message}
                </div>
              )}

              {detail.status === 'PARTIALLY_RECEIVED' && (
                <div className="bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  Some items on this order were already received in a previous round — quantities below default to what's still outstanding.
                </div>
              )}

              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2">Ordered</th>
                        <th className="px-3 py-2 w-28">Received</th>
                        <th className="px-3 py-2">Est. Cost</th>
                        <th className="px-3 py-2 w-28">Actual Cost</th>
                        <th className="px-3 py-2">Variance</th>
                        <th className="px-3 py-2">Update ingredient cost?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((l, i) => {
                        const variancePercent = l.estimatedUnitCost > 0 ? ((l.actualUnitCost - l.estimatedUnitCost) / l.estimatedUnitCost) * 100 : 0;
                        const overThreshold = Math.abs(variancePercent) > 5;
                        return (
                          <tr key={l.ingredientId}>
                            <td className="px-3 py-2">
                              <p className="text-xs font-medium text-slate-700">{l.name}</p>
                              {l.alreadyReceived > 0 && (
                                <p className="text-[10px] text-slate-400">{l.alreadyReceived} {l.unit} already received</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">{l.orderedQty} {l.unit}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="any" value={l.receivedQty}
                                onChange={(e) => updateLine(i, { receivedQty: Number(e.target.value) })}
                                className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                              />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">PKR {l.estimatedUnitCost.toLocaleString()}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="any" value={l.actualUnitCost}
                                onChange={(e) => updateLine(i, { actualUnitCost: Number(e.target.value) })}
                                className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-bold ${overThreshold ? 'text-amber-600' : 'text-slate-400'}`}>
                                {variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <label className={`inline-flex items-center gap-1.5 ${overThreshold ? '' : 'opacity-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={l.updateIngredientCost}
                                  onChange={(e) => updateLine(i, { updateIngredientCost: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-[#ff5722]"
                                />
                                <span className="text-[11px] text-slate-500">Update cost</span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium text-slate-500">Total received value</span>
                <span className="text-sm font-bold text-slate-900">PKR {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier invoice number (optional)</label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-1234"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything worth noting..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                disabled={receivePO.isPending}
                onClick={handleSubmit}
                className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {receivePO.isPending ? 'Saving...' : 'Confirm Receipt'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
