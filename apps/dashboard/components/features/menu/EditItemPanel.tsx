'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Sparkles, UploadCloud, GripVertical, Loader2, Plus, Trash2, ChevronDown, ChevronRight, Tag,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/user-context';
import { useCreateItem, useUpdateItem } from './hooks/useMenuQueries';
import { menuApi } from '@/lib/api/menu';
import { useDashboardContext } from '@/contexts/dashboard-context';

const UNIT_TYPES = [
  'Per Item',
  'Per KG',
  'Per 500g',
  'Per 250g',
  'Per 100g',
  'Per Litre',
  'Per 500ml',
];

const SUGGESTED_TAGS = ['Bestseller', 'Spicy', 'Halal', 'Vegetarian', 'New', 'Seasonal'];

const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  basePrice: z.coerce.number().min(0, 'Price must be 0 or greater'),
  unitType: z.string().default('Per Item'),
  description: z.string().optional(),
  isAvailable: z.boolean().default(true),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface Variation { id?: string; name: string; price: number }
interface AddOn { id?: string; name: string; price: number }

interface EditItemPanelProps {
  item: any;
  categories: any[];
  mode: 'create' | 'edit';
  onClose: () => void;
  onSaved?: () => void;
  width?: number;
}

export function EditItemPanel({ item, categories, mode, onClose, onSaved, width = 384 }: EditItemPanelProps) {
  const { tenantId } = useUser();
  const { selectedBranchId } = useDashboardContext();
  const queryClient = useQueryClient();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const [aiLoading, setAiLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variations
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationsOpen, setVariationsOpen] = useState(true);

  // Add-ons
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [addOnsOpen, setAddOnsOpen] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      basePrice: 0,
      unitType: 'Per Item',
      description: '',
      isAvailable: true,
    },
  });

  useEffect(() => {
    if (item && mode === 'edit') {
      form.reset({
        name: item.name,
        categoryId: item.categoryId,
        basePrice: item.basePrice ?? 0,
        unitType: item.unitType ?? 'Per Item',
        description: item.description ?? '',
        isAvailable: item.isAvailable ?? true,
      });
      setImagePreview(item.image ?? null);
      setVariations(item.variations?.map((v: any) => ({ id: v.id, name: v.name, price: v.price })) ?? []);
      setAddOns(item.addOns?.map((a: any) => ({ id: a.id, name: a.name, price: a.price })) ?? []);
      setTags(item.tags ?? []);
    } else {
      form.reset({ name: '', categoryId: '', basePrice: 0, unitType: 'Per Item', description: '', isAvailable: true });
      setImagePreview(null);
      setImageFile(null);
      setVariations([]);
      setAddOns([]);
      setTags([]);
    }
    setServerError(null);
  }, [item?.id, mode]);

  const isAvailableValue = form.watch('isAvailable');

  const handleAiGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = form.getValues('name');
    const catId = form.getValues('categoryId');
    const cat = categories.find((c) => c.id === catId);
    if (!name) { toast.error('Enter item name first'); return; }
    setAiLoading(true);
    try {
      const result = await menuApi.generateAIDescription(name, cat?.name ?? '');
      form.setValue('description', result.description);
    } catch {
      toast.error('Failed to generate description');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max file size is 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    if (mode === 'edit' && item?.id) {
      setUploading(true);
      try {
        const result = await menuApi.uploadImage(item.id, file);
        setImagePreview(result.imageUrl);
        queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
        toast.success('Image uploaded');
      } catch { toast.error('Failed to upload image'); }
      finally { setUploading(false); }
    }
  };

  const handleRemoveImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'edit' && item?.id) {
      try {
        await menuApi.deleteImage(item.id);
        queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
        toast.success('Image removed');
      } catch { toast.error('Failed to remove image'); }
    }
    setImagePreview(null);
    setImageFile(null);
  };

  const addVariation = () => setVariations([...variations, { name: '', price: 0 }]);
  const removeVariation = (i: number) => setVariations(variations.filter((_, idx) => idx !== i));
  const updateVariationField = (i: number, field: keyof Variation, value: string | number) => {
    setVariations(variations.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };

  const addAddOn = () => setAddOns([...addOns, { name: '', price: 0 }]);
  const removeAddOn = (i: number) => setAddOns(addOns.filter((_, idx) => idx !== i));
  const updateAddOnField = (i: number, field: keyof AddOn, value: string | number) => {
    setAddOns(addOns.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
  };

  const onSubmit = async (values: ItemFormValues) => {
    setServerError(null);
    const cleanVariations = variations.filter((v) => v.name.trim());
    const cleanAddOns = addOns.filter((a) => a.name.trim());

    try {
      if (mode === 'create') {
        const newItem = await createItem.mutateAsync({
          tenantId,
          categoryId: values.categoryId,
          name: values.name,
          description: values.description,
          basePrice: values.basePrice,
          isAvailable: values.isAvailable,
          variations: cleanVariations,
          addOns: cleanAddOns,
          tags: tags,
          branchId: selectedBranchId,
        });
        if (imageFile && (newItem as any)?.id) {
          setUploading(true);
          try {
            await menuApi.uploadImage((newItem as any).id, imageFile);
            queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
          } finally { setUploading(false); }
        }
        toast.success('Item saved');
        onSaved?.();
        onClose();
      } else {
        await updateItem.mutateAsync({
          id: item.id,
          data: {
            name: values.name,
            categoryId: values.categoryId,
            basePrice: values.basePrice,
            description: values.description,
            isAvailable: values.isAvailable,
            variations: cleanVariations,
            addOns: cleanAddOns,
            tags: tags,
          },
        });
        toast.success('Item saved');
        onSaved?.();
        onClose();
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to save item');
    }
  };

  const isPending = createItem.isPending || updateItem.isPending || uploading;

  return (
    <div className="shrink-0 bg-white border-l border-slate-200 h-full flex flex-col z-10 shadow-[-4px_0_20px_-4px_rgba(0,0,0,0.07)]" style={{ width }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
        <div>
          <h2 className="font-black text-slate-900 text-sm">
            {mode === 'edit' ? 'Edit Item' : 'New Item'}
          </h2>
          {mode === 'edit' && item && (
            <p className="text-[9px] text-slate-300 font-mono mt-0.5">ID: {item.id}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form */}
      <form id="item-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* Server error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              {serverError}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Item Name *
              </label>
              <input
                {...form.register('name')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-[#ff5722] focus:ring-0 outline-none"
                placeholder="e.g. Zinger Burger"
              />
              {form.formState.errors.name && (
                <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  {...form.register('categoryId')}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] focus:ring-0 outline-none bg-white"
                >
                  <option value="">Select...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {form.formState.errors.categoryId && (
                  <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.categoryId.message}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Base Price (PKR) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  {...form.register('basePrice', { valueAsNumber: true })}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] focus:ring-0 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Unit Type
              </label>
              <select
                {...form.register('unitType')}
                className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] focus:ring-0 outline-none bg-white"
              >
                {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#ff5722] hover:text-orange-700 flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md transition-colors disabled:opacity-50"
                  onClick={handleAiGenerate}
                  disabled={aiLoading}
                >
                  {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  {aiLoading ? 'Generating...' : <span className="flex items-center gap-1"><Sparkles size={10} /> AI Generate</span>}
                </button>
              </div>
              <textarea
                {...form.register('description')}
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] focus:ring-0 outline-none resize-none"
                placeholder="Describe this item..."
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Availability */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Available</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Show this item on POS</p>
            </div>
            <button
              type="button"
              onClick={() => form.setValue('isAvailable', !isAvailableValue)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                isAvailableValue ? 'bg-green-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  isAvailableValue ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Image Upload */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
              Image
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-[#ff5722]/30 transition-colors cursor-pointer group"
              >
                <div className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <UploadCloud size={18} className="text-[#ff5722]" />
                </div>
                <p className="text-xs font-semibold text-slate-600">Drop image or click to upload</p>
                <p className="text-[10px] text-slate-400 mt-1">PNG JPG WEBP up to 5MB</p>
              </div>
            ) : (
              <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-200 group">
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                    <Loader2 className="animate-spin text-[#ff5722]" size={22} />
                  </div>
                )}
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1.5 right-1.5 p-1 bg-white/90 backdrop-blur-sm rounded-full text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Variations */}
          <div>
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setVariationsOpen(!variationsOpen)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {variationsOpen ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Variations
                </span>
                <span className="text-[10px] text-slate-400">e.g. Small, Medium, Large</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); addVariation(); if (!variationsOpen) setVariationsOpen(true); }}
                className="text-[10px] font-bold text-[#ff5722] flex items-center gap-1 hover:bg-orange-50 px-2 py-0.5 rounded"
              >
                <Plus size={10} /> Add
              </button>
            </div>

            {variationsOpen && variations.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {variations.map((v, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <GripVertical size={12} className="text-slate-300 cursor-grab shrink-0" />
                    <input
                      className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] outline-none"
                      placeholder="Name (e.g. Medium)"
                      value={v.name}
                      onChange={(e) => updateVariationField(i, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      min={0}
                      className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] outline-none"
                      placeholder="PKR"
                      value={v.price}
                      onChange={(e) => updateVariationField(i, 'price', Number(e.target.value))}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariation(i)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Add-ons */}
          <div>
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setAddOnsOpen(!addOnsOpen)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {addOnsOpen ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Add-ons / Modifiers
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); addAddOn(); if (!addOnsOpen) setAddOnsOpen(true); }}
                className="text-[10px] font-bold text-[#ff5722] flex items-center gap-1 hover:bg-orange-50 px-2 py-0.5 rounded"
              >
                <Plus size={10} /> Add
              </button>
            </div>

            {addOnsOpen && addOns.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {addOns.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <GripVertical size={12} className="text-slate-300 cursor-grab shrink-0" />
                    <input
                      className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] outline-none"
                      placeholder="Name (e.g. Extra Cheese)"
                      value={a.name}
                      onChange={(e) => updateAddOnField(i, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      min={0}
                      className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] outline-none"
                      placeholder="+PKR"
                      value={a.price}
                      onChange={(e) => updateAddOnField(i, 'price', Number(e.target.value))}
                    />
                    <button
                      type="button"
                      onClick={() => removeAddOn(i)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-[10px] font-bold bg-[#ff5722]/10 text-[#ff5722] px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="hover:text-red-600"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-[#ff5722] outline-none"
              placeholder="Type a tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-[10px] font-medium text-slate-400 hover:text-[#ff5722] hover:bg-orange-50 px-1.5 py-0.5 rounded border border-slate-100 hover:border-[#ff5722]/20 transition-colors flex items-center gap-1"
                >
                  <Tag size={8} /> {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 bg-white flex gap-2 shrink-0">
        <button
          type="button"
          className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="item-form"
          className="flex-1 py-2 bg-[#ff5722] text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-1.5"
          disabled={isPending}
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          {isPending ? 'Saving...' : 'Save Item'}
        </button>
      </div>
    </div>
  );
}
