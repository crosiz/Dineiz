'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Search, Trash2, AlertCircle, ArrowRight } from 'lucide-react';
import { useTransfers, useBranchIngredientStock } from '../hooks/useTransfers';
import { BranchSelect } from '@/components/ui/branch-select';

interface LineDraft {
  ingredientId: string;
  name: string;
  baseUnit: string;
  availableAtFrom: number;
  requestedQty: number;
}

interface CreateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  createTransfer: ReturnType<typeof useTransfers>['createTransfer'];
}

export function CreateTransferModal({ isOpen, onClose, createTransfer }: CreateTransferModalProps) {
  const [fromBranchId, setFromBranchId] = useState<string | null>(null);
  const [toBranchId, setToBranchId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const { data: fromBranchIngredients = [] } = useBranchIngredientStock(fromBranchId);

  useEffect(() => {
    if (!isOpen) {
      setFromBranchId(null);
      setToBranchId(null);
      setNotes('');
      setLines([]);
      setFormError(null);
      setPickerOpen(false);
      setPickerSearch('');
    }
  }, [isOpen]);

  // Switching the From branch invalidates any previously-added lines' stock context — clear them
  // rather than silently carrying over quantities checked against a different branch's stock.
  useEffect(() => {
    setLines([]);
  }, [fromBranchId]);

  if (!isOpen) return null;

  const availableIngredients = fromBranchIngredients.filter(
    (ing: any) => !lines.some((l) => l.ingredientId === ing.id) && ing.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const addLine = (ing: any) => {
    setLines((prev) => [
      ...prev,
      { ingredientId: ing.id, name: ing.name, baseUnit: ing.unit, availableAtFrom: ing.inStock ?? 0, requestedQty: 1 },
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

  const validate = (): string | null => {
    if (!fromBranchId) return 'Please select a source branch';
    if (!toBranchId) return 'Please select a destination branch';
    if (fromBranchId === toBranchId) return 'Source and destination branches must be different';
    if (lines.length === 0) return 'Add at least one ingredient';
    if (lines.some((l) => !l.requestedQty || l.requestedQty <= 0)) return 'Every line needs a quantity greater than 0';
    return null;
  };

  const handleClose = () => {
    setPickerOpen(false);
    onClose();
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    createTransfer.mutate(
      {
        fromBranchId: fromBranchId!,
        toBranchId: toBranchId!,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({ ingredientId: l.ingredientId, requestedQty: l.requestedQty, unit: l.baseUnit })),
      },
      { onSuccess: () => handleClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-[620px] max-w-full bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Create Stock Transfer</h2>
            <p className="text-[13px] text-slate-500">Move ingredients from one branch to another</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          onClick={() => pickerOpen && setPickerOpen(false)}
        >
          {(createTransfer.error || formError) && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {formError || (createTransfer.error as any)?.message}
            </div>
          )}

          {/* ── Branches ───────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Branches</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">From</label>
                <BranchSelect value={fromBranchId} onChange={setFromBranchId} placeholder="Source branch" required />
              </div>
              <ArrowRight size={16} className="text-slate-300 mt-5" />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">To</label>
                <BranchSelect value={toBranchId} onChange={setToBranchId} placeholder="Destination branch" required />
              </div>
            </div>
          </div>

          {/* ── Line items ─────────────────────────────────────────── */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Ingredients</p>

            {!fromBranchId ? (
              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-3 py-3 text-center">
                Select a source branch to see what's available to transfer
              </p>
            ) : (
              <>
                {lines.length > 0 && (
                  <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
                    <div className="grid grid-cols-[1fr_90px_80px_28px] gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Ingredient</span><span>Available</span><span>Qty to send</span><span />
                    </div>
                    {lines.map((l, i) => {
                      const over = l.requestedQty > l.availableAtFrom;
                      return (
                        <div key={l.ingredientId} className="grid grid-cols-[1fr_90px_80px_28px] gap-2 px-3 py-2 items-center">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{l.name}</p>
                          </div>
                          <span className="text-xs text-slate-500">{l.availableAtFrom} {l.baseUnit}</span>
                          <input
                            type="number" min="0.01" step="any" value={l.requestedQty}
                            onChange={(e) => updateLine(i, { requestedQty: Number(e.target.value) })}
                            className={`h-8 px-2 rounded border text-xs w-full ${over ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                          />
                          <button type="button" onClick={() => removeLine(i)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                    {lines.some((l) => l.requestedQty > l.availableAtFrom) && (
                      <div className="px-3 py-2 bg-amber-50 text-amber-700 text-[11px] flex items-center gap-1.5">
                        <AlertCircle size={12} className="shrink-0" />
                        One or more quantities exceed what's currently on hand at the source branch.
                      </div>
                    )}
                  </div>
                )}

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
                          availableIngredients.slice(0, 30).map((ing: any) => (
                            <button
                              key={ing.id}
                              type="button"
                              onClick={() => addLine(ing)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                            >
                              <span className="text-xs font-medium text-slate-700">{ing.name}</span>
                              <span className="text-[10px] text-slate-400">{ing.inStock ?? 0} {ing.unit} in stock</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 pt-4">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Why this transfer is needed..."
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end items-center gap-3 shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTransfer.isPending}
            className="px-4 py-2 bg-brand-primary text-white rounded-md text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {createTransfer.isPending ? 'Creating...' : 'Create Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
