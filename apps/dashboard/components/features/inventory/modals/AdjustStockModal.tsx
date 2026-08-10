'use client';

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInventory, InventoryItem } from '../hooks/useInventory';
import { useDashboardContext } from '@/contexts/dashboard-context';

const schema = z.object({
  type: z.enum(['ADD', 'SUBTRACT']),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const REASONS = [
  'Received Delivery', 
  'Manual Correction', 
  'Damaged', 
  'Expired', 
  'Other'
];

interface AdjustStockModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AdjustStockModal({ item, isOpen, onClose }: AdjustStockModalProps) {
  const { adjustStock } = useInventory();
  const { selectedBranchId } = useDashboardContext();
  
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'ADD',
      quantity: 0,
      reason: 'Manual Correction',
    }
  });

  const selectedType = watch('type');

  if (!isOpen || !item) return null;

  const onSubmit = (data: FormData) => {
    // Currently, adjustments apply to the active scoped branch from the hook, 
    // but the backend adjust endpoint requires branchId in the body since it can be done globally.
    // For simplicity, if we don't have branch context, we'll assume the item has a primary branch or we use 'All Branches'.
    // Ideally we pass branchId. Since we don't have it explicitly right now, let's hardcode for the first branch or mock it.
    // Wait, the hook calls `/api/inventory/ingredients/:id/adjust`.
    adjustStock.mutate({
      id: item.id,
      data: {
        ...data,
        // Use the globally scoped branch from DashboardContext
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      }
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
          <h2 className="text-lg font-bold text-slate-900">{item.name}</h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-100 flex justify-between items-center">
            <span className="text-sm font-medium text-orange-900">Current Stock</span>
            <span className="text-xl font-bold text-orange-600">{item.inStock} {item.unit}</span>
          </div>

          <form id="adjust-stock-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {adjustStock.error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {(adjustStock.error as any).message}
              </div>
            )}

            {/* Type Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setValue('type', 'ADD')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${selectedType === 'ADD' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                + Add Stock
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'SUBTRACT')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${selectedType === 'SUBTRACT' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                - Remove Stock
              </button>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <div className="relative">
                <input 
                  {...register('quantity', { valueAsNumber: true })}
                  type="number" 
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{item.unit}</span>
              </div>
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
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <input 
                {...register('notes')}
                type="text" 
                placeholder="Brief explanation..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5722]/20 focus:border-[#ff5722] transition-colors"
              />
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
            form="adjust-stock-form"
            disabled={adjustStock.isPending}
            className="px-5 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {adjustStock.isPending ? 'Saving...' : 'Adjust Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
