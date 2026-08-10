'use client';

import React, { useState } from 'react';
import { X, UploadCloud, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInventory } from '../hooks/useInventory';
import { useBranches } from '@/hooks/useBranches';

// ─── Schema ───────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Produce', 'Meat & Poultry', 'Dairy', 'Bakery',
  'Beverages', 'Spices & Condiments', 'Dry Goods', 'Other',
];
const UNITS = ['kg', 'g', 'litre', 'ml', 'pieces', 'dozen', 'box', 'bag'] as const;

// Backend unit enum mapping
const UNIT_MAP: Record<string, string> = {
  kg: 'KILOGRAM', g: 'GRAM', litre: 'LITER', ml: 'ML',
  pieces: 'PCS', dozen: 'PCS', box: 'PCS', bag: 'PCS',
};

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.enum(UNITS),
  initialStock: z.number().min(0).default(0),
  minThreshold: z.number().min(0).default(0),
  branchIds: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  costPerUnit: z.number().min(0).default(0),
  supplierName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────
interface AddIngredientPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddIngredientPanel({ isOpen, onClose }: AddIngredientPanelProps) {
  const { createIngredient } = useInventory();
  const { data: branches = [], isError: branchesError } = useBranches();
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors }, reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'Produce',
      unit: 'kg',
      initialStock: 0,
      minThreshold: 0,
      branchIds: [],
      costPerUnit: 0,
    },
  });

  const selectedUnit = watch('unit');
  const selectedBranchIds = watch('branchIds');

  const toggleBranch = (id: string) => {
    const current = selectedBranchIds ?? [];
    if (current.includes(id)) {
      setValue('branchIds', current.filter((b) => b !== id));
    } else {
      setValue('branchIds', [...current, id]);
    }
  };

  const toggleAllBranches = () => {
    if (selectedBranchIds.length === branches.length) {
      setValue('branchIds', []);
    } else {
      setValue('branchIds', branches.map((b) => b.id));
    }
  };

  if (!isOpen) return null;

  const onSubmit = (data: FormData) => {
    const category = showCustomCategory && customCategory ? customCategory : data.category;
    createIngredient.mutate(
      {
        name: data.name,
        category,
        unit: UNIT_MAP[data.unit] ?? 'GRAM',
        minThreshold: data.minThreshold,
        initialStock: data.initialStock,
        branchIds: data.branchIds,
        imageUrl: data.imageUrl || undefined,
        notes: data.notes,
        costPerUnit: data.costPerUnit,
        supplierName: data.supplierName || undefined,
      },
      {
        onSuccess: () => {
          reset();
          setCustomCategory('');
          setShowCustomCategory(false);
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="relative w-[420px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Add Ingredient</h2>
            <p className="text-[13px] text-slate-500">Configure stock item details</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          id="add-ingredient-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-6 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* Error banner */}
          {createIngredient.error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {(createIngredient.error as any).message}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              INGREDIENT NAME *
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Fresh Tomatoes"
              className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${
                errors.name ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              CATEGORY *
            </label>
            {!showCustomCategory ? (
              <div className="flex gap-2">
                <select
                  {...register('category')}
                  className="flex-1 h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomCategory(true)}
                  className="h-10 px-3 text-xs text-slate-700 font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  + Custom
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type custom category..."
                  className="flex-1 h-10 px-3 rounded-md border border-slate-400 text-sm focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomCategory(false)}
                  className="h-10 px-3 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              UNIT OF MEASURE *
            </label>
            <select
              {...register('unit')}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Stock + Threshold in a row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                CURRENT STOCK
              </label>
              <div className="relative">
                <input
                  {...register('initialStock', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={`w-full h-10 px-3 pr-9 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${
                    errors.initialStock ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{selectedUnit}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                MIN THRESHOLD
              </label>
              <div className="relative">
                <input
                  {...register('minThreshold', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={`w-full h-10 px-3 pr-9 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${
                    errors.minThreshold ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{selectedUnit}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Alert triggers below this</p>
            </div>
          </div>

          {/* Cost and Supplier */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                COST PER UNIT (PKR)
              </label>
              <input
                {...register('costPerUnit', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 150.00"
                className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${
                  errors.costPerUnit ? 'border-red-300' : 'border-slate-200'
                }`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                PREFERRED SUPPLIER
              </label>
              <input
                {...register('supplierName')}
                placeholder="e.g. Metro Cash & Carry"
                className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          {/* Branch availability multi-select */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              BRANCH AVAILABILITY
            </label>
            {branchesError ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50">
                <RefreshCw size={13} className="text-slate-400" />
                <span className="text-xs text-slate-400">Branch filter unavailable</span>
              </div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400">
                No branches found
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                {/* Select all row */}
                <button
                  type="button"
                  onClick={toggleAllBranches}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-200 text-slate-700 font-medium"
                >
                  {selectedBranchIds.length === branches.length ? (
                    <CheckSquare size={16} className="text-slate-900" />
                  ) : (
                    <Square size={16} className="text-slate-300" />
                  )}
                  All Branches
                </button>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-0"
                  >
                    {selectedBranchIds.includes(branch.id) ? (
                      <CheckSquare size={16} className="text-slate-900" />
                    ) : (
                      <Square size={16} className="text-slate-300" />
                    )}
                    <span className="text-slate-700">{branch.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Image URL (optional) */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              IMAGE URL (OPTIONAL)
            </label>
            <div className="border border-dashed border-slate-300 rounded-md p-4 flex flex-col items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors">
              <UploadCloud size={20} className="text-slate-400" />
              <p className="text-xs text-slate-500 text-center">Paste image URL or upload to Cloudinary</p>
              <input
                {...register('imageUrl')}
                placeholder="https://res.cloudinary.com/..."
                className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-slate-400 transition-colors"
              />
              {errors.imageUrl && <p className="text-red-500 text-xs">{errors.imageUrl.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              NOTES (OPTIONAL)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Special storage or handling notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-ingredient-form"
            disabled={createIngredient.isPending}
            className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {createIngredient.isPending ? 'Saving...' : 'Save Ingredient'}
          </button>
        </div>
      </div>
    </div>
  );
}
