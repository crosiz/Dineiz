'use client';

import React, { useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInventory } from '../hooks/useInventory';
import { useWastage, WASTAGE_REASONS } from '../hooks/useWastage';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { formatPKR } from '@/lib/formatters';
import { humanizeReason, MANAGER_PIN_REVIEW_THRESHOLD } from './wastageConstants';

const schema = z
  .object({
    ingredientId: z.string().min(1, 'Select an ingredient'),
    quantity: z.number({ invalid_type_error: 'Enter a quantity' }).positive('Quantity must be greater than 0'),
    reason: z.string().min(1, 'Reason is required'),
    notes: z.string().optional(),
    photoUrl: z.string().optional(),
  })
  .refine((data) => data.reason !== 'OTHER' || !!data.notes?.trim(), {
    message: 'Notes are required when reason is "Other"',
    path: ['notes'],
  });

type FormData = z.infer<typeof schema>;

interface AddWastageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWastageModal({ isOpen, onClose }: AddWastageModalProps) {
  const { inventoryList } = useInventory();
  const { createWastage } = useWastage();
  const { selectedBranchId } = useDashboardContext();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: undefined, reason: 'EXPIRED', notes: '', photoUrl: '' },
  });

  const ingredientId = watch('ingredientId');
  const quantity = watch('quantity');
  const reason = watch('reason');

  const selectedIngredient = useMemo(
    () => inventoryList.find((i) => i.id === ingredientId) ?? null,
    [inventoryList, ingredientId]
  );

  const costImpact = useMemo(() => {
    if (!selectedIngredient || !quantity || Number.isNaN(quantity)) return 0;
    return quantity * (selectedIngredient.costPerUnit || 0);
  }, [selectedIngredient, quantity]);

  const exceedsThreshold = costImpact > MANAGER_PIN_REVIEW_THRESHOLD;

  if (!isOpen) return null;

  const handleClose = () => {
    reset({ quantity: undefined, reason: 'EXPIRED', notes: '', photoUrl: '', ingredientId: undefined });
    onClose();
  };

  const onSubmit = (data: FormData) => {
    if (!selectedBranchId) return;
    createWastage.mutate(
      {
        ingredientId: data.ingredientId,
        quantity: data.quantity,
        reason: data.reason,
        branchId: selectedBranchId,
        notes: data.notes?.trim() || undefined,
        photoUrl: data.photoUrl?.trim() || undefined,
      },
      { onSuccess: handleClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Log Wastage</h2>
            <p className="text-[13px] text-slate-500">Record spoiled, damaged, or lost stock</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form id="log-wastage-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-5">
          {!selectedBranchId && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Select a specific branch from the branch switcher (not &ldquo;All Branches&rdquo;) before logging wastage.</span>
            </div>
          )}

          {createWastage.error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {(createWastage.error as any)?.message ?? 'Failed to log wastage'}
            </div>
          )}

          {/* Ingredient */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ingredient *</label>
            <select
              {...register('ingredientId')}
              className={`w-full h-10 px-3 rounded-md border bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors ${errors.ingredientId ? 'border-red-300' : 'border-slate-200'}`}
            >
              <option value="">Select ingredient...</option>
              {inventoryList.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            {errors.ingredientId && <p className="text-red-500 text-xs mt-1">{errors.ingredientId.message}</p>}
            {selectedIngredient && (
              <p className="text-xs text-slate-500 mt-1.5">
                {selectedIngredient.inStock.toLocaleString()} {selectedIngredient.unit} available
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Quantity Lost {selectedIngredient ? `(${selectedIngredient.unit})` : ''} *
            </label>
            <input
              {...register('quantity', { valueAsNumber: true })}
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${errors.quantity ? 'border-red-300' : 'border-slate-200'}`}
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>

          {/* Live cost impact preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estimated Cost Impact</span>
            <span className="text-lg font-bold text-slate-900">{formatPKR(costImpact)}</span>
          </div>

          {exceedsThreshold && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>This wastage exceeds {formatPKR(MANAGER_PIN_REVIEW_THRESHOLD)} — a manager should review this before submitting.</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reason *</label>
            <div className="grid grid-cols-2 gap-2">
              {WASTAGE_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                    reason === r ? 'border-[#ff5722] bg-orange-50 text-slate-900 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input type="radio" value={r} {...register('reason')} className="accent-[#ff5722]" />
                  {humanizeReason(r)}
                </label>
              ))}
            </div>
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Notes {reason === 'OTHER' ? '*' : '(Optional)'}
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder={reason === 'OTHER' ? 'Explain what happened...' : 'Brief explanation...'}
              className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none ${errors.notes ? 'border-red-300' : 'border-slate-200'}`}
            />
            {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Photo URL (Optional)</label>
            <input
              {...register('photoUrl')}
              type="text"
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="log-wastage-form"
            disabled={createWastage.isPending || !selectedBranchId}
            className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createWastage.isPending ? 'Saving...' : 'Log Wastage'}
          </button>
        </div>
      </div>
    </div>
  );
}
