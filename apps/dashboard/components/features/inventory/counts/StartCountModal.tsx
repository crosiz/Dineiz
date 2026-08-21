'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useCounts, CountSession } from '../hooks/useCounts';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { CATEGORIES, COUNT_TYPES } from './countConstants';

interface StartCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStarted: (session: CountSession) => void;
}

export function StartCountModal({ isOpen, onClose, onStarted }: StartCountModalProps) {
  const { inventoryList } = useInventory();
  const { startCount } = useCounts();
  const { selectedBranchId } = useDashboardContext();

  const [countType, setCountType] = useState<'FULL' | 'PARTIAL' | 'SPOT'>('FULL');
  const [categories, setCategories] = useState<string[]>([]);
  const [ingredientIds, setIngredientIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const reset = () => {
    setCountType('FULL');
    setCategories([]);
    setIngredientIds([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const toggleIngredient = (id: string) => {
    setIngredientIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const isValid =
    !!selectedBranchId &&
    (countType === 'FULL' || (countType === 'PARTIAL' && categories.length > 0) || (countType === 'SPOT' && ingredientIds.length > 0));

  const handleSubmit = () => {
    if (!selectedBranchId || !isValid) return;
    const payload: { branchId: string; countType: 'FULL' | 'PARTIAL' | 'SPOT'; categories?: string[]; ingredientIds?: string[] } = {
      branchId: selectedBranchId,
      countType,
    };
    if (countType === 'PARTIAL') payload.categories = categories;
    if (countType === 'SPOT') payload.ingredientIds = ingredientIds;

    startCount.mutate(payload, {
      onSuccess: (session) => {
        reset();
        onClose();
        onStarted(session);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Start Physical Count</h2>
            <p className="text-[13px] text-slate-500">Choose what to count</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!selectedBranchId && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Select a specific branch from the branch switcher (not &ldquo;All Branches&rdquo;) before starting a count.</span>
            </div>
          )}

          {startCount.error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {(startCount.error as any)?.message ?? 'Failed to start count'}
            </div>
          )}

          {/* Count type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Count Type</label>
            <div className="space-y-2">
              {COUNT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    countType === t.value ? 'border-[#ff5722] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="countType"
                    value={t.value}
                    checked={countType === t.value}
                    onChange={() => setCountType(t.value)}
                    className="mt-0.5 accent-[#ff5722]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Categories for PARTIAL */}
          {countType === 'PARTIAL' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Categories *</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      categories.includes(cat) ? 'border-[#ff5722] bg-orange-50 text-[#ff5722]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {categories.length === 0 && <p className="text-xs text-slate-400 mt-2">Select at least one category</p>}
            </div>
          )}

          {/* Ingredients for SPOT */}
          {countType === 'SPOT' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ingredients *</label>
              <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto divide-y divide-slate-100">
                {inventoryList.length === 0 ? (
                  <p className="text-sm text-slate-400 px-3 py-4 text-center">No ingredients found</p>
                ) : (
                  inventoryList.map((item) => (
                    <label key={item.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={ingredientIds.includes(item.id)}
                        onChange={() => toggleIngredient(item.id)}
                        className="accent-[#ff5722]"
                      />
                      <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                      <span className="text-xs text-slate-400">{item.inStock} {item.unit}</span>
                    </label>
                  ))
                )}
              </div>
              {ingredientIds.length === 0 && <p className="text-xs text-slate-400 mt-2">Select at least one ingredient</p>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={startCount.isPending || !isValid}
            className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startCount.isPending ? 'Starting...' : 'Start Count'}
          </button>
        </div>
      </div>
    </div>
  );
}
