'use client';

import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInventory } from '../hooks/useInventory';
import { useDashboardContext } from '@/contexts/dashboard-context';

const schema = z.object({
  ingredientId: z.string().min(1, 'Ingredient is required'),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const REASONS = [
  'Expired', 
  'Spoiled', 
  'Damaged', 
  'Theft', 
  'Other'
];

interface AddWastageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWastageModal({ isOpen, onClose }: AddWastageModalProps) {
  const { inventoryList, createWastage } = useInventory();
  const { selectedBranchId } = useDashboardContext();
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: 0,
      reason: 'Expired',
    }
  });

  if (!isOpen) return null;

  const onSubmit = (data: FormData) => {
    createWastage.mutate({
      ...data,
      // Use the globally scoped branch from DashboardContext
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
    }, {
      onSuccess: () => {
        reset();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">Log New Wastage</h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form id="log-wastage-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {createWastage.error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {(createWastage.error as any).message}
              </div>
            )}

            {/* Ingredient */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ingredient <span className="text-red-500">*</span></label>
              <select 
                {...register('ingredientId')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors bg-white"
              >
                <option value="">Select ingredient...</option>
                {inventoryList.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {errors.ingredientId && <p className="text-red-500 text-xs mt-1">{errors.ingredientId.message}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Lost <span className="text-red-500">*</span></label>
              <input 
                {...register('quantity', { valueAsNumber: true })}
                type="number" 
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors"
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select 
                {...register('reason')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors bg-white"
              >
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <textarea 
                {...register('notes')}
                rows={2}
                placeholder="Brief explanation..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button"
            className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="log-wastage-form"
            disabled={createWastage.isPending}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {createWastage.isPending ? 'Saving...' : 'Log Wastage'}
          </button>
        </div>
      </div>
    </div>
  );
}
