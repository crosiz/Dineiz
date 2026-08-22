'use client';

import React, { useEffect, useState } from 'react';
import { X, UploadCloud, RefreshCw, CheckSquare, Square, Plus, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useInventory, InventoryItem } from '../hooks/useInventory';
import { useSuppliers } from '../hooks/useSuppliers';
import { useBranches, Branch } from '@/hooks/useBranches';

// ─── Schema ───────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'MEAT', 'VEGETABLES', 'DAIRY', 'GRAINS', 'SPICES', 'OILS', 'BEVERAGES', 'PACKAGING', 'CLEANING', 'Other',
];
const UNITS = ['GRAM', 'KILOGRAM', 'ML', 'LITER', 'PCS'] as const;
const STORAGE_TYPES = ['FROZEN', 'CHILLED', 'DRY', 'AMBIENT'];

// An untouched number input registered with { valueAsNumber: true } yields NaN,
// not undefined — and z.number().optional() only treats undefined as "absent",
// so NaN fails validation and silently blocks the whole form's submit. Accept
// NaN as an alternate branch and fold it to undefined (keeps clean type inference,
// unlike z.preprocess which widens the field's input type to unknown).
const optionalPositiveInt = z.number().int().positive().optional().or(z.nan().transform(() => undefined));

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameUrdu: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.enum(UNITS),
  purchaseUnit: z.enum(UNITS),
  purchaseToBase: z.number().positive('Must be greater than 0'),
  minThreshold: z.number().min(0),
  costPerPurchaseUnit: z.number().min(0),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  shelfLifeDays: optionalPositiveInt,
  storageType: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface BranchStockRow {
  branchId: string;
  initialStock: number;
  minThreshold: number;
  maxThreshold: number | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AddIngredientPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editIngredient?: InventoryItem | null;
}

export function AddIngredientPanel({ isOpen, onClose, editIngredient }: AddIngredientPanelProps) {
  const { createIngredient, updateIngredient, deleteIngredient, fetchIngredientUsage } = useInventory();
  const { suppliers, createSupplier } = useSuppliers();
  const { data: branches = [], isError: branchesError } = useBranches();
  const isEdit = !!editIngredient;

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [branchRows, setBranchRows] = useState<BranchStockRow[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ usage: { itemId: string; itemName: string }[] } | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors }, reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'MEAT', unit: 'GRAM', purchaseUnit: 'KILOGRAM', purchaseToBase: 1000,
      minThreshold: 0, costPerPurchaseUnit: 0,
    },
  });

  useEffect(() => {
    if (editIngredient) {
      reset({
        name: editIngredient.name,
        nameUrdu: editIngredient.nameUrdu || '',
        sku: editIngredient.sku || '',
        barcode: editIngredient.barcode || '',
        category: editIngredient.category,
        unit: (editIngredient.unit as any) || 'GRAM',
        purchaseUnit: (editIngredient.purchaseUnit as any) || (editIngredient.unit as any) || 'KILOGRAM',
        purchaseToBase: editIngredient.purchaseToBase || 1,
        minThreshold: editIngredient.minThreshold,
        costPerPurchaseUnit: (editIngredient.costPerUnit || 0) * (editIngredient.purchaseToBase || 1),
        supplierId: editIngredient.supplier?.id || undefined,
        supplierName: editIngredient.supplierName || '',
        shelfLifeDays: editIngredient.shelfLifeDays || undefined,
        storageType: editIngredient.storageType || undefined,
        imageUrl: editIngredient.imageUrl || '',
      });
    } else {
      reset({ category: 'MEAT', unit: 'GRAM', purchaseUnit: 'KILOGRAM', purchaseToBase: 1000, minThreshold: 0, costPerPurchaseUnit: 0 });
      setBranchRows(branches.map((b: Branch) => ({ branchId: b.id, initialStock: 0, minThreshold: 0, maxThreshold: undefined })));
    }
  }, [editIngredient, branches.length]);

  const purchaseUnit = watch('purchaseUnit');
  const baseUnit = watch('unit');
  const purchaseToBase = watch('purchaseToBase');
  const costPerPurchaseUnit = watch('costPerPurchaseUnit');

  if (!isOpen) return null;

  const costPerBase = purchaseToBase > 0 ? (costPerPurchaseUnit / purchaseToBase) : 0;

  const updateBranchRow = (branchId: string, patch: Partial<BranchStockRow>) => {
    setBranchRows((rows) => rows.map((r) => (r.branchId === branchId ? { ...r, ...patch } : r)));
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    createSupplier.mutate({ name: newSupplierName.trim() }, {
      onSuccess: (supplier: any) => {
        setValue('supplierId', supplier.id);
        setNewSupplierName('');
        setShowNewSupplier(false);
      },
    });
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name,
      nameUrdu: data.nameUrdu || undefined,
      sku: data.sku || undefined,
      barcode: data.barcode || undefined,
      category: data.category,
      unit: data.unit,
      purchaseUnit: data.purchaseUnit,
      purchaseToBase: data.purchaseToBase,
      minThreshold: data.minThreshold,
      costPerPurchaseUnit: data.costPerPurchaseUnit,
      supplierId: data.supplierId || undefined,
      supplierName: data.supplierName || undefined,
      shelfLifeDays: data.shelfLifeDays || undefined,
      storageType: data.storageType || undefined,
      imageUrl: data.imageUrl || undefined,
    };

    if (isEdit && editIngredient) {
      updateIngredient.mutate({ id: editIngredient.id, data: payload }, { onSuccess: () => { reset(); onClose(); } });
    } else {
      createIngredient.mutate(
        { ...payload, branchStocks: branchRows.filter((r) => r.initialStock > 0 || r.minThreshold > 0 || r.maxThreshold) },
        { onSuccess: () => { reset(); onClose(); } }
      );
    }
  };

  const handleDeleteClick = async () => {
    if (!editIngredient) return;
    setIsCheckingUsage(true);
    try {
      const usage = await fetchIngredientUsage(editIngredient.id);
      setDeleteConfirm({ usage });
    } catch {
      setDeleteConfirm({ usage: [] });
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const confirmDelete = () => {
    if (!editIngredient) return;
    deleteIngredient.mutate(editIngredient.id, { onSuccess: () => { setDeleteConfirm(null); onClose(); } });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[460px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">{isEdit ? 'Edit Ingredient' : 'Add Ingredient'}</h2>
            <p className="text-[13px] text-slate-500">Configure stock item details</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form id="add-ingredient-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {(createIngredient.error || updateIngredient.error) && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {((createIngredient.error || updateIngredient.error) as any)?.message}
            </div>
          )}

          {/* ── Basic info ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Basic Info</p>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Name *</label>
              <input {...register('name')} placeholder="e.g. Chicken Breast" className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Name in Urdu (optional)</label>
              <input {...register('nameUrdu')} placeholder="مرغی کا گوشت" dir="rtl" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Category *</label>
                <select {...register('category')} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">SKU (optional)</label>
                <input {...register('sku')} placeholder="CHK-001" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Barcode (optional)</label>
              <input {...register('barcode')} placeholder="Scan or type" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
          </div>

          {/* ── Units and cost ─────────────────────────────────────────── */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Units and Cost</p>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">How do you buy this? *</label>
                <select {...register('purchaseUnit')} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Cost per {purchaseUnit} (PKR) *</label>
                <input {...register('costPerPurchaseUnit', { valueAsNumber: true })} type="number" min="0" step="0.01" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">How do recipes measure this? *</label>
                <select {...register('unit')} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">1 {purchaseUnit} = ? {baseUnit} *</label>
                <input {...register('purchaseToBase', { valueAsNumber: true })} type="number" min="0.0001" step="any" className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${errors.purchaseToBase ? 'border-red-300' : 'border-slate-200'}`} />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs text-slate-600">
              <p>1 {purchaseUnit} = {purchaseToBase || 0} {baseUnit}</p>
              <p className="font-semibold text-slate-800 mt-0.5">Cost per {baseUnit}: PKR {costPerBase.toFixed(4)}</p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Min Threshold (in {baseUnit})</label>
              <input {...register('minThreshold', { valueAsNumber: true })} type="number" min="0" step="0.01" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              <p className="text-xs text-slate-400 mt-1">Low-stock alert triggers below this</p>
            </div>
          </div>

          {/* ── Stock settings per branch (create only) ──────────────────── */}
          {!isEdit && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Stock Settings (per branch)</p>
              {branchesError ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50">
                  <RefreshCw size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-400">Branch list unavailable</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
                  <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Branch</span><span>Initial</span><span>Min</span><span>Max</span>
                  </div>
                  {branchRows.map((row) => {
                    const branch = branches.find((b: Branch) => b.id === row.branchId);
                    return (
                      <div key={row.branchId} className="grid grid-cols-4 gap-2 px-3 py-2 items-center">
                        <span className="text-xs font-medium text-slate-700 truncate">{branch?.name}</span>
                        <input type="number" min="0" step="0.01" value={row.initialStock} onChange={(e) => updateBranchRow(row.branchId, { initialStock: Number(e.target.value) })} className="h-8 px-2 rounded border border-slate-200 text-xs" />
                        <input type="number" min="0" step="0.01" value={row.minThreshold} onChange={(e) => updateBranchRow(row.branchId, { minThreshold: Number(e.target.value) })} className="h-8 px-2 rounded border border-slate-200 text-xs" />
                        <input type="number" min="0" step="0.01" value={row.maxThreshold ?? ''} onChange={(e) => updateBranchRow(row.branchId, { maxThreshold: e.target.value ? Number(e.target.value) : undefined })} placeholder="—" className="h-8 px-2 rounded border border-slate-200 text-xs" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Supplier and storage ──────────────────────────────────── */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Supplier and Storage</p>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Supplier</label>
              {!showNewSupplier ? (
                <div className="flex gap-2">
                  <select {...register('supplierId')} className="flex-1 h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors">
                    <option value="">None / informal</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewSupplier(true)} className="h-10 px-3 text-xs text-slate-700 font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-1">
                    <Plus size={13} /> New
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Supplier name..." className="flex-1 h-10 px-3 rounded-md border border-slate-400 text-sm focus:outline-none transition-colors" />
                  <button type="button" onClick={handleAddSupplier} disabled={createSupplier.isPending} className="h-10 px-3 text-xs text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors">Add</button>
                  <button type="button" onClick={() => setShowNewSupplier(false)} className="h-10 px-3 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              )}
              <input {...register('supplierName')} placeholder="Or an informal supplier name..." className="w-full h-9 px-3 mt-2 rounded-md border border-slate-200 text-xs focus:outline-none focus:border-slate-400 transition-colors" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Storage Type</label>
                <select {...register('storageType')} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-400 appearance-none transition-colors">
                  <option value="">—</option>
                  {STORAGE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Shelf Life (days)</label>
                <input {...register('shelfLifeDays', { valueAsNumber: true })} type="number" min="1" placeholder="7" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>
          </div>

          {/* ── Image ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Image URL (optional)</label>
            <div className="border border-dashed border-slate-300 rounded-md p-4 flex flex-col items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors">
              <UploadCloud size={20} className="text-slate-400" />
              <input {...register('imageUrl')} placeholder="https://res.cloudinary.com/..." className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:border-slate-400 transition-colors" />
              {errors.imageUrl && <p className="text-red-500 text-xs">{errors.imageUrl.message}</p>}
            </div>
          </div>

          {isEdit && (
            <div className="pt-4 border-t border-slate-100">
              <button type="button" onClick={handleDeleteClick} disabled={isCheckingUsage} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                {isCheckingUsage ? 'Checking usage...' : 'Delete this ingredient'}
              </button>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">Cancel</button>
          <button type="submit" form="add-ingredient-form" disabled={createIngredient.isPending || updateIngredient.isPending} className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50">
            {(createIngredient.isPending || updateIngredient.isPending) ? 'Saving...' : (isEdit ? 'Save Changes' : 'Save Ingredient')}
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete {editIngredient?.name}?</h3>
            </div>
            {deleteConfirm.usage.length > 0 ? (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">This ingredient is used in {deleteConfirm.usage.length} recipe(s):</p>
                <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                  {deleteConfirm.usage.map((u) => <li key={u.itemId}>{u.itemName}</li>)}
                </ul>
                <p className="text-sm text-slate-600 mt-2">Deleting won't break those recipes — this ingredient is skipped silently in deductions, but you should double check. Continue?</p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-4">This ingredient isn't used in any recipes. This action can't be undone from the UI.</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteIngredient.isPending} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteIngredient.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
