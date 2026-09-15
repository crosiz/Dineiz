'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Loader2, Plus, ChevronDown, ChevronRight, Tag, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/user-context';
import { useCreateItem, useUpdateItem, useSetItemBranchConfig } from './hooks/useMenuQueries';
import { menuApi } from '@/lib/api/menu';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { UNIT_TYPES } from './menuCsv';

const SUGGESTED_TAGS = ['Bestseller', 'Spicy', 'Halal', 'Vegetarian', 'New', 'Seasonal'];

const LABEL = 'block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5';
const INPUT =
  'w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all';

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
}

export function EditItemPanel({ item, categories, mode, onClose, onSaved }: EditItemPanelProps) {
  const { tenantId } = useUser();
  const { selectedBranchId, selectedBranchName } = useDashboardContext();
  const branchScoped = !!selectedBranchId;
  const queryClient = useQueryClient();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const setBranchConfig = useSetItemBranchConfig();

  const [aiLoading, setAiLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationsOpen, setVariationsOpen] = useState(true);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [addOnsOpen, setAddOnsOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [branchPrice, setBranchPrice] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ItemFormValues>({
    // zod .default()/.coerce make the resolver's input type diverge from the
    // form value type — the runtime behaviour is correct, so cast the resolver.
    resolver: zodResolver(itemSchema) as any,
    defaultValues: { name: '', categoryId: '', basePrice: 0, unitType: 'Per Item', description: '', isAvailable: true },
  });

  useEffect(() => {
    if (item && mode === 'edit') {
      form.reset({
        name: item.name,
        categoryId: item.categoryId,
        basePrice: item.globalBasePrice ?? item.basePrice ?? 0,
        unitType: item.unitType ?? 'Per Item',
        description: item.description ?? '',
        isAvailable: item.isAvailable ?? true,
      });
      setImagePreview(item.image ?? null);
      setVariations(item.variations?.map((v: any) => ({ id: v.id, name: v.name, price: v.price })) ?? []);
      setAddOns(item.addOns?.map((a: any) => ({ id: a.id, name: a.name, price: a.price })) ?? []);
      setTags(item.tags ?? []);
      setBranchPrice(item.branchOverridePrice != null ? String(item.branchOverridePrice) : '');
      setAddOnsOpen((item.addOns?.length ?? 0) > 0);
    } else {
      form.reset({ name: '', categoryId: '', basePrice: 0, unitType: 'Per Item', description: '', isAvailable: true });
      setImagePreview(null);
      setImageFile(null);
      setVariations([]);
      setAddOns([]);
      setTags([]);
      setBranchPrice('');
    }
    setServerError(null);
  }, [item?.id, mode]);

  const isAvailableValue = form.watch('isAvailable');

  const handleAiSuggest = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = form.getValues('name');
    const cat = categories.find((c) => c.id === form.getValues('categoryId'));
    if (!name) { toast.error('Enter the item name first'); return; }
    setAiLoading(true);
    try {
      const result = await menuApi.generateAIDescription(name, cat?.name ?? '');
      form.setValue('description', result.description);
    } catch {
      toast.error('Could not suggest a description');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max image size is 5MB'); return; }
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
      } catch { toast.error('Failed to remove image'); }
    }
    setImagePreview(null);
    setImageFile(null);
  };

  const addVariation = () => setVariations((v) => [...v, { name: '', price: 0 }]);
  const removeVariation = (i: number) => setVariations((v) => v.filter((_, idx) => idx !== i));
  const updateVariationField = (i: number, field: keyof Variation, value: string | number) =>
    setVariations((v) => v.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const addAddOn = () => setAddOns((a) => [...a, { name: '', price: 0 }]);
  const removeAddOn = (i: number) => setAddOns((a) => a.filter((_, idx) => idx !== i));
  const updateAddOnField = (i: number, field: keyof AddOn, value: string | number) =>
    setAddOns((a) => a.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

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
    const cleanVariations = variations.filter((v) => v.name.trim()).map((v) => ({ ...v, price: Number(v.price) || 0 }));
    const cleanAddOns = addOns.filter((a) => a.name.trim()).map((a) => ({ ...a, price: Number(a.price) || 0 }));
    const branchOverride = branchPrice.trim() === '' ? null : Number(branchPrice);
    if (branchScoped && branchOverride !== null && (!Number.isFinite(branchOverride) || branchOverride < 0)) {
      setServerError('Branch price must be a number of 0 or more');
      return;
    }

    try {
      if (mode === 'create') {
        const newItem: any = await createItem.mutateAsync({
          tenantId,
          categoryId: values.categoryId,
          name: values.name,
          description: values.description,
          basePrice: values.basePrice,
          unitType: values.unitType,
          isAvailable: branchScoped ? true : values.isAvailable,
          variations: cleanVariations,
          addOns: cleanAddOns,
          tags,
          branchId: selectedBranchId,
        });
        if (branchScoped && newItem?.id && (branchOverride !== null || !values.isAvailable)) {
          await setBranchConfig.mutateAsync({
            itemId: newItem.id,
            branchId: selectedBranchId!,
            isAvailable: values.isAvailable,
            overridePrice: branchOverride,
          });
        }
        if (imageFile && newItem?.id) {
          setUploading(true);
          try {
            await menuApi.uploadImage(newItem.id, imageFile);
            queryClient.invalidateQueries({ queryKey: ['menu', 'items'] });
          } finally { setUploading(false); }
        }
      } else {
        await updateItem.mutateAsync({
          id: item.id,
          data: {
            name: values.name,
            categoryId: values.categoryId,
            basePrice: values.basePrice,
            unitType: values.unitType,
            description: values.description,
            // In a specific branch, availability is managed per-branch below.
            ...(branchScoped ? {} : { isAvailable: values.isAvailable }),
            variations: cleanVariations,
            addOns: cleanAddOns,
            tags,
          },
        });
        if (branchScoped) {
          await setBranchConfig.mutateAsync({
            itemId: item.id,
            branchId: selectedBranchId!,
            isAvailable: values.isAvailable,
            overridePrice: branchOverride,
          });
        }
      }
      toast.success('Item saved');
      onSaved?.();
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'Failed to save item');
    }
  };

  const isPending = createItem.isPending || updateItem.isPending || setBranchConfig.isPending || uploading;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[480px] max-w-full bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{mode === 'edit' ? 'Edit item' : 'New item'}</h2>
            <p className="text-sm text-slate-500">
              {branchScoped ? `Editing for ${selectedBranchName}` : 'Applies to every branch'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form id="item-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {serverError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{serverError}</div>
            )}

            {/* Details */}
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Item name *</label>
                <input {...form.register('name')} className={INPUT} placeholder="e.g. Zinger Burger" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Category *</label>
                  <select {...form.register('categoryId')} className={`${INPUT} px-2.5`}>
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {form.formState.errors.categoryId && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.categoryId.message}</p>
                  )}
                </div>
                <div>
                  <label className={LABEL}>Base price (PKR) *</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    {...form.register('basePrice', { valueAsNumber: true })}
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Unit type</label>
                <select {...form.register('unitType')} className={`${INPUT} px-2.5`}>
                  {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`${LABEL} mb-0`}>Description</label>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    className="text-xs font-semibold text-[#ff5722] hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {aiLoading ? 'Suggesting…' : 'Suggest'}
                  </button>
                </div>
                <textarea
                  {...form.register('description')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                  placeholder="Describe this item…"
                />
              </div>
            </div>

            {/* Availability */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {branchScoped ? `Available at ${selectedBranchName}` : 'Available by default'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Show this item on the POS</p>
              </div>
              <button
                type="button"
                onClick={() => form.setValue('isAvailable', !isAvailableValue)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${isAvailableValue ? 'bg-green-500' : 'bg-slate-200'}`}
                aria-label="Toggle availability"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isAvailableValue ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Per-branch price */}
            {branchScoped && (
              <div className="border border-orange-100 bg-orange-50/50 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={13} className="text-[#ff5722]" />
                  <p className="text-sm font-medium text-slate-800">Price at {selectedBranchName}</p>
                </div>
                <p className="text-xs text-slate-500 mb-2.5">Leave blank to use the base price everywhere.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={branchPrice}
                    onChange={(e) => setBranchPrice(e.target.value)}
                    placeholder={`Base — ${form.watch('basePrice') || 0}`}
                    className={`${INPUT} bg-white`}
                  />
                  {branchPrice !== '' && (
                    <button
                      type="button"
                      onClick={() => setBranchPrice('')}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Image */}
            <div className="border-t border-slate-100 pt-5">
              <label className={LABEL}>Photo</label>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/jpeg,image/png,image/webp" className="hidden" />
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-[#ff5722]/30 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center mb-2">
                    <UploadCloud size={18} className="text-[#ff5722]" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Click to upload</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG or WEBP up to 5MB</p>
                </div>
              ) : (
                <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 group">
                  {uploading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <Loader2 className="animate-spin text-[#ff5722]" size={22} />
                    </div>
                  )}
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
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

            {/* Variations */}
            <Section
              title="Variations"
              hint="e.g. Small, Medium, Large"
              open={variationsOpen}
              onToggle={() => setVariationsOpen((v) => !v)}
              onAdd={() => { addVariation(); setVariationsOpen(true); }}
            >
              {variations.length > 0 && (
                <div className="space-y-1.5">
                  {variations.map((v, i) => (
                    <PriceRow
                      key={i}
                      name={v.name}
                      price={v.price}
                      namePlaceholder="Name (e.g. Large)"
                      pricePlaceholder="Price"
                      onName={(val) => updateVariationField(i, 'name', val)}
                      onPrice={(val) => updateVariationField(i, 'price', val)}
                      onRemove={() => removeVariation(i)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Add-ons */}
            <Section
              title="Add-ons"
              hint="Optional extras with a surcharge"
              open={addOnsOpen}
              onToggle={() => setAddOnsOpen((v) => !v)}
              onAdd={() => { addAddOn(); setAddOnsOpen(true); }}
            >
              {addOns.length > 0 && (
                <div className="space-y-1.5">
                  {addOns.map((a, i) => (
                    <PriceRow
                      key={i}
                      name={a.name}
                      price={a.price}
                      namePlaceholder="Name (e.g. Extra Cheese)"
                      pricePlaceholder="+ PKR"
                      onName={(val) => updateAddOnField(i, 'name', val)}
                      onPrice={(val) => updateAddOnField(i, 'price', val)}
                      onRemove={() => removeAddOn(i)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Tags */}
            <div className="border-t border-slate-100 pt-5">
              <label className={LABEL}>Tags</label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-medium bg-[#ff5722]/10 text-[#ff5722] px-2 py-0.5 rounded-full">
                      {tag}
                      <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-600">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className={INPUT}
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-xs font-medium text-slate-500 hover:text-[#ff5722] hover:bg-orange-50 px-2 py-0.5 rounded-md border border-slate-200 hover:border-[#ff5722]/30 transition-colors flex items-center gap-1"
                  >
                    <Tag size={10} /> {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="item-form"
            disabled={isPending}
            className="flex-1 h-10 bg-[#ff5722] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-1.5"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Saving…' : 'Save item'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  open,
  onToggle,
  onAdd,
  children,
}: {
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</span>
          <span className="text-xs text-slate-400 font-normal normal-case">{hint}</span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-[#ff5722] flex items-center gap-1 hover:bg-orange-50 px-2 py-1 rounded-md"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function PriceRow({
  name,
  price,
  namePlaceholder,
  pricePlaceholder,
  onName,
  onPrice,
  onRemove,
}: {
  name: string;
  price: number;
  namePlaceholder: string;
  pricePlaceholder: string;
  onName: (v: string) => void;
  onPrice: (v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        className="flex-1 h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100"
        placeholder={namePlaceholder}
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
      <input
        type="number"
        min={0}
        step="1"
        className="w-24 h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100"
        placeholder={pricePlaceholder}
        value={price}
        onChange={(e) => onPrice(Number(e.target.value))}
      />
      <button type="button" onClick={onRemove} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}
