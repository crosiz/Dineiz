'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Search, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { usePurchaseOrders, usePurchaseOrderDetail } from '../hooks/usePurchaseOrders';
import { useSuppliers } from '../hooks/useSuppliers';
import { useInventory, InventoryItem } from '../hooks/useInventory';
import { BranchSelect } from '@/components/ui/branch-select';

interface LineDraft {
  ingredientId: string;
  name: string;
  currentStock: number;
  baseUnit: string;
  unit: string;
  orderedQty: number;
  estimatedUnitCost: number;
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal opens in edit mode for this PO (DRAFT only — supplier/date/notes only, per backend contract). */
  editId?: string | null;
  createPO: ReturnType<typeof usePurchaseOrders>['createPO'];
  updatePO: ReturnType<typeof usePurchaseOrders>['updatePO'];
  sendPO: ReturnType<typeof usePurchaseOrders>['sendPO'];
}

export function CreatePOModal({ isOpen, onClose, editId, createPO, updatePO, sendPO }: CreatePOModalProps) {
  const isEdit = !!editId;
  const { data: detail, isLoading: isDetailLoading } = usePurchaseOrderDetail(isEdit ? editId! : null);
  const { suppliers } = useSuppliers();
  const { inventoryList } = useInventory();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const initKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initKey.current = null;
      return;
    }
    const key = `${isEdit}-${editId ?? 'new'}`;
    if (initKey.current === key) return;

    if (isEdit) {
      if (!detail) return; // wait for detail to load before initializing
      setBranchId(detail.branchId);
      setSupplierId(detail.supplier?.id ?? '');
      setSupplierName(detail.supplierName ?? '');
      // NOTE: PurchaseOrderDetail's TS type (usePurchaseOrders.ts) doesn't declare `expectedDate`,
      // even though PurchaseOrderSummary does and the PUT endpoint accepts it. Reading defensively
      // in case the API actually returns it — see final report.
      const rawExpected = (detail as any).expectedDate as string | null | undefined;
      setExpectedDate(rawExpected ? String(rawExpected).slice(0, 10) : '');
      setNotes(detail.notes ?? '');
      setLines(
        detail.lines.map((l) => ({
          ingredientId: l.ingredientId,
          name: l.ingredient.name,
          currentStock: 0,
          baseUnit: l.ingredient.unit,
          unit: l.unit || l.ingredient.purchaseUnit || l.ingredient.unit,
          orderedQty: l.orderedQty,
          estimatedUnitCost: l.estimatedUnitCost,
        }))
      );
    } else {
      setBranchId(null);
      setSupplierId('');
      setSupplierName('');
      setExpectedDate('');
      setNotes('');
      setLines([]);
    }
    setFormError(null);
    initKey.current = key;
  }, [isOpen, isEdit, editId, detail]);

  if (!isOpen) return null;

  const availableIngredients = inventoryList.filter(
    (ing) =>
      !lines.some((l) => l.ingredientId === ing.id) &&
      ing.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const addLine = (ing: InventoryItem) => {
    const unit = ing.purchaseUnit || ing.unit;
    const estimatedUnitCost = Number(((ing.costPerUnit || 0) * (ing.purchaseToBase || 1)).toFixed(4));
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ing.id,
        name: ing.name,
        currentStock: ing.inStock,
        baseUnit: ing.unit,
        unit,
        orderedQty: 1,
        estimatedUnitCost,
      },
    ]);
    setPickerOpen(false);
    setPickerSearch('');
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const runningTotal = lines.reduce((sum, l) => sum + (l.orderedQty || 0) * (l.estimatedUnitCost || 0), 0);

  const validateCreate = (): string | null => {
    if (!branchId) return 'Please select a branch';
    if (lines.length === 0) return 'Add at least one line item';
    if (lines.some((l) => !l.orderedQty || l.orderedQty <= 0)) return 'Every line needs a quantity greater than 0';
    return null;
  };

  const buildCreatePayload = () => ({
    branchId,
    supplierId: supplierId || undefined,
    supplierName: !supplierId && supplierName.trim() ? supplierName.trim() : undefined,
    expectedDate: expectedDate || undefined,
    notes: notes.trim() || undefined,
    lines: lines.map((l) => ({
      ingredientId: l.ingredientId,
      orderedQty: l.orderedQty,
      unit: l.unit || undefined,
      estimatedUnitCost: l.estimatedUnitCost,
    })),
  });

  const handleClose = () => {
    setPickerOpen(false);
    onClose();
  };

  const handleSaveDraft = () => {
    const err = validateCreate();
    if (err) {
      setFormError(err);
      return;
    }
    createPO.mutate(buildCreatePayload(), { onSuccess: () => handleClose() });
  };

  const handleSaveAndSend = () => {
    const err = validateCreate();
    if (err) {
      setFormError(err);
      return;
    }
    createPO.mutate(buildCreatePayload(), {
      onSuccess: (po: any) => {
        sendPO.mutate(po.id, { onSuccess: () => handleClose() });
      },
    });
  };

  const handleSaveEdit = () => {
    if (!editId) return;
    updatePO.mutate(
      {
        id: editId,
        data: {
          supplierId: supplierId || undefined,
          supplierName: !supplierId && supplierName.trim() ? supplierName.trim() : undefined,
          expectedDate: expectedDate || undefined,
          notes: notes.trim() || undefined,
        },
      },
      { onSuccess: () => handleClose() }
    );
  };

  const isNotDraftAnymore = isEdit && detail && detail.status !== 'DRAFT';
  const isPending = createPO.isPending || updatePO.isPending || sendPO.isPending;
  const error = createPO.error || updatePO.error || sendPO.error;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-[620px] max-w-full bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">{isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
            <p className="text-[13px] text-slate-500">
              {isEdit ? detail?.poNumber ?? 'Loading...' : 'Draft a new order to send to a supplier'}
            </p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {isEdit && isDetailLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading order...
          </div>
        ) : (
          <>
            <div
              className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              onClick={() => pickerOpen && setPickerOpen(false)}
            >
              {(error || formError) && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  {formError || (error as any)?.message}
                </div>
              )}

              {isNotDraftAnymore && (
                <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  This order is no longer a draft ({detail?.status.replace('_', ' ').toLowerCase()}) — it can't be edited anymore.
                </div>
              )}

              {/* ── Branch ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Branch</p>
                {isEdit ? (
                  <div className="h-10 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-600">
                    {detail?.branch.name} <span className="text-slate-400 ml-2 text-xs">(can't be changed)</span>
                  </div>
                ) : (
                  <BranchSelect value={branchId} onChange={setBranchId} placeholder="Select branch" required />
                )}
              </div>

              {/* ── Supplier ───────────────────────────────────────────── */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Supplier</p>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Registered supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors"
                  >
                    <option value="">None / type a name instead</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {!supplierId && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Or an informal supplier name</label>
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="e.g. Local vegetable vendor"
                      className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Expected delivery date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* ── Line items ─────────────────────────────────────────── */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between pt-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Line Items</p>
                  {isEdit && <span className="text-[11px] text-slate-400">Items can't be changed after creation</span>}
                </div>

                {lines.length > 0 && (
                  <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
                    <div className="grid grid-cols-[1fr_80px_70px_90px_90px_28px] gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Ingredient</span><span>Qty</span><span>Unit</span><span>Cost/Unit</span><span>Total</span><span />
                    </div>
                    {lines.map((l, i) => (
                      <div key={l.ingredientId} className="grid grid-cols-[1fr_80px_70px_90px_90px_28px] gap-2 px-3 py-2 items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{l.name}</p>
                          {!isEdit && <p className="text-[10px] text-slate-400">In stock: {l.currentStock} {l.baseUnit}</p>}
                        </div>
                        {isEdit ? (
                          <span className="text-xs text-slate-600">{l.orderedQty}</span>
                        ) : (
                          <input
                            type="number" min="0.01" step="any" value={l.orderedQty}
                            onChange={(e) => updateLine(i, { orderedQty: Number(e.target.value) })}
                            className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                          />
                        )}
                        {isEdit ? (
                          <span className="text-xs text-slate-600">{l.unit}</span>
                        ) : (
                          <input
                            value={l.unit}
                            onChange={(e) => updateLine(i, { unit: e.target.value })}
                            className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                          />
                        )}
                        {isEdit ? (
                          <span className="text-xs text-slate-600">{l.estimatedUnitCost.toLocaleString()}</span>
                        ) : (
                          <input
                            type="number" min="0" step="any" value={l.estimatedUnitCost}
                            onChange={(e) => updateLine(i, { estimatedUnitCost: Number(e.target.value) })}
                            className="h-8 px-2 rounded border border-slate-200 text-xs w-full"
                          />
                        )}
                        <span className="text-xs font-semibold text-slate-800">
                          {((l.orderedQty || 0) * (l.estimatedUnitCost || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        {!isEdit ? (
                          <button type="button" onClick={() => removeLine(i)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                )}

                {!isEdit && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPickerOpen((v) => !v); }}
                      className="w-full h-9 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded-md text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Plus size={13} /> Add ingredient
                    </button>
                    {pickerOpen && (
                      <div
                        className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              autoFocus
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                              placeholder="Search ingredients..."
                              className="w-full h-8 pl-7 pr-2 rounded border border-slate-200 text-xs focus:outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto">
                          {availableIngredients.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No matching ingredients</p>
                          ) : (
                            availableIngredients.slice(0, 30).map((ing) => (
                              <button
                                key={ing.id}
                                type="button"
                                onClick={() => addLine(ing)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                              >
                                <span className="text-xs font-medium text-slate-700">{ing.name}</span>
                                <span className="text-[10px] text-slate-400">{ing.inStock} {ing.unit} in stock</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center px-1 pt-1">
                  <span className="text-xs font-medium text-slate-500">Estimated total</span>
                  <span className="text-sm font-bold text-slate-900">PKR {runningTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* ── Notes ──────────────────────────────────────────────── */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 pt-4">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Delivery instructions, special requests..."
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
                Cancel
              </button>
              {isEdit ? (
                <button
                  onClick={handleSaveEdit}
                  disabled={isPending || !!isNotDraftAnymore}
                  className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={isPending}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    {createPO.isPending && !sendPO.isPending ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={handleSaveAndSend}
                    disabled={isPending}
                    className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {sendPO.isPending ? 'Sending...' : 'Save and Send to Supplier'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
