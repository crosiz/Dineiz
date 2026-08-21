'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertCircle, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface ItemVariation {
  id: string;
  name: string;
  price: number;
  hasRecipe: boolean;
}

interface RecipeListItem {
  itemId: string;
  itemName: string;
  categoryName: string;
  hasRecipe: boolean;
  hasVariations: boolean;
  variations: ItemVariation[];
}

interface CopyRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecipeListItem[];
  sourceItemId: string;
  sourceVariationId: string | null;
  sourceLabel: string;
}

export function CopyRecipeModal({
  isOpen,
  onClose,
  items,
  sourceItemId,
  sourceVariationId,
  sourceLabel,
}: CopyRecipeModalProps) {
  const queryClient = useQueryClient();
  const [targetItemId, setTargetItemId] = useState('');
  const [targetVariationId, setTargetVariationId] = useState<string>('');

  const targetItem = useMemo(() => items.find((i) => i.itemId === targetItemId) || null, [items, targetItemId]);

  const copyMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/inventory/recipes/copy', {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId,
          sourceVariationId: sourceVariationId || null,
          targetItemId,
          targetVariationId: targetVariationId || null,
        }),
      }),
    onSuccess: () => {
      toast.success('Recipe copied successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to copy recipe'),
  });

  const handleClose = () => {
    setTargetItemId('');
    setTargetVariationId('');
    onClose();
  };

  if (!isOpen) return null;

  const isSameAsSource =
    !!targetItemId && targetItemId === sourceItemId && (targetVariationId || null) === (sourceVariationId || null);

  const targetVariationLabel = targetVariationId
    ? targetItem?.variations.find((v) => v.id === targetVariationId)?.name
    : 'Base Recipe';

  const targetAlreadyHasRecipe = targetVariationId
    ? !!targetItem?.variations.find((v) => v.id === targetVariationId)?.hasRecipe
    : !!targetItem?.hasRecipe;

  const handleSubmit = () => {
    if (!targetItemId || isSameAsSource) return;
    copyMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Copy size={18} className="text-slate-400" />
            Copy Recipe
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {copyMutation.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {(copyMutation.error as any).message}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600">
            Copying from <span className="font-semibold text-slate-900">{sourceLabel}</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Target Item
            </label>
            <select
              value={targetItemId}
              onChange={(e) => {
                setTargetItemId(e.target.value);
                setTargetVariationId('');
              }}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors"
            >
              <option value="">Select an item...</option>
              {items.map((item) => (
                <option key={item.itemId} value={item.itemId}>
                  {item.itemName} ({item.categoryName})
                </option>
              ))}
            </select>
          </div>

          {targetItem?.hasVariations && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Target Variation
              </label>
              <select
                value={targetVariationId}
                onChange={(e) => setTargetVariationId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors"
              >
                <option value="">Base Recipe</option>
                {targetItem.variations.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isSameAsSource && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              Source and target are the same recipe. Choose a different item or variation.
            </div>
          )}

          {!isSameAsSource && targetItemId && targetAlreadyHasRecipe && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {targetItem?.itemName} ({targetVariationLabel}) already has a recipe. Copying will overwrite it.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!targetItemId || isSameAsSource || copyMutation.isPending}
            className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {copyMutation.isPending ? 'Copying...' : 'Copy Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
