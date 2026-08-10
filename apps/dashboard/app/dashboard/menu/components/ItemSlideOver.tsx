'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Wand2, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@swiftserve/ui/src/components/button';
import { Input } from '@swiftserve/ui/src/components/input';
import { toast } from 'sonner';

type Category = { id: string; name: string };
type Variation = { name: string; priceOverride: number };
type AddOn = { name: string; additionalPrice: number };

type ItemForm = {
  name: string;
  categoryId: string;
  basePrice: string;
  description: string;
  isAvailable: boolean;
  imageUrl?: string;
  variations: Variation[];
  addOns: AddOn[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  itemToEdit: any | null;
  defaultCategoryId?: string;
};

const EMPTY_FORM: ItemForm = {
  name: '',
  categoryId: '',
  basePrice: '',
  description: '',
  isAvailable: true,
  imageUrl: undefined,
  variations: [],
  addOns: [],
};

export default function ItemSlideOver({ isOpen, onClose, onSuccess, categories, itemToEdit, defaultCategoryId }: Props) {
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (itemToEdit) {
      setForm({
        name: itemToEdit.name || '',
        categoryId: itemToEdit.categoryId || defaultCategoryId || '',
        basePrice: String(itemToEdit.basePrice || ''),
        description: itemToEdit.description || '',
        isAvailable: itemToEdit.isAvailable ?? true,
        imageUrl: itemToEdit.imageUrl,
        variations: itemToEdit.variations || [],
        addOns: itemToEdit.addOns || [],
      });
      setImagePreview(itemToEdit.imageUrl || null);
    } else {
      setForm({ ...EMPTY_FORM, categoryId: defaultCategoryId || '' });
      setImagePreview(null);
    }
    setImageFile(null);
    setError('');
  }, [isOpen, itemToEdit, defaultCategoryId]);

  const setField = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const generateAI = async () => {
    if (!form.name.trim()) { toast.error('Enter an item name first'); return; }
    setAiLoading(true);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || '';
      const res = await fetch('http://localhost:8080/api/menu/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, category: catName }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.description) { setField('description', data.description); toast.success('Description generated!'); }
      else toast.error('Generation failed');
    } catch { toast.error('AI generation failed'); }
    finally { setAiLoading(false); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (itemId: string): Promise<string | null> => {
    if (!imageFile) return form.imageUrl || null;
    const fd = new FormData();
    fd.append('image', imageFile);
    try {
      const res = await fetch(`http://localhost:8080/api/menu/items/${itemId}/image`, {
        method: 'POST', body: fd, credentials: 'include',
      });
      const data = await res.json();
      return data.url || null;
    } catch { return null; }
  };

  // Variations
  const addVariation = () => setField('variations', [...form.variations, { name: '', priceOverride: 0 }]);
  const removeVariation = (i: number) => setField('variations', form.variations.filter((_, idx) => idx !== i));
  const updateVariation = (i: number, field: keyof Variation, value: string | number) =>
    setField('variations', form.variations.map((v, idx) => idx === i ? { ...v, [field]: value } : v));

  // Add-ons
  const addAddOn = () => setField('addOns', [...form.addOns, { name: '', additionalPrice: 0 }]);
  const removeAddOn = (i: number) => setField('addOns', form.addOns.filter((_, idx) => idx !== i));
  const updateAddOn = (i: number, field: keyof AddOn, value: string | number) =>
    setField('addOns', form.addOns.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Item name is required'); return; }
    if (!form.categoryId) { setError('Please select a category'); return; }
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return; }

    setLoading(true);
    setError('');

    try {
      const url = itemToEdit
        ? `http://localhost:8080/api/menu/items/${itemToEdit.id}`
        : 'http://localhost:8080/api/menu/items';
      const method = itemToEdit ? 'PUT' : 'POST';

      const body = {
        name: form.name.trim(),
        categoryId: form.categoryId,
        basePrice: price,
        description: form.description.trim(),
        isAvailable: form.isAvailable,
        variations: form.variations.filter(v => v.name.trim()),
        addOns: form.addOns.filter(a => a.name.trim()),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save item'); return; }

      // Upload image if selected
      if (imageFile && data.id) await uploadImage(data.id);

      toast.success(itemToEdit ? 'Item updated' : 'Item created');
      onSuccess();
      onClose();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'block text-sm font-medium mb-1.5';
  const inputClass = 'flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:border-neutral-800 dark:focus-visible:ring-neutral-300';

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-neutral-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <h2 className="text-xl font-semibold">{itemToEdit ? 'Edit Item' : 'Add Menu Item'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{error}</div>}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Item Name <span className="text-red-500">*</span></label>
              <Input name="name" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Classic Burger" />
            </div>

            <div>
              <label className={labelClass}>Category <span className="text-red-500">*</span></label>
              <select
                value={form.categoryId}
                onChange={e => setField('categoryId', e.target.value)}
                className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-neutral-300"
              >
                <option value="">Select a category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Base Price (PKR) <span className="text-red-500">*</span></label>
              <Input name="price" type="number" min={0} step="0.01" value={form.basePrice} onChange={e => setField('basePrice', e.target.value)} placeholder="550" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Description</label>
                <button
                  type="button"
                  onClick={generateAI}
                  disabled={aiLoading}
                  className="flex items-center text-xs text-brand-primary font-medium hover:text-brand-primary/80 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                  {aiLoading ? 'Generating...' : 'Generate with AI'}
                </button>
              </div>
              <textarea
                name="description"
                className={inputClass}
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="A delicious description..."
              />
            </div>

            {/* Available Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div>
                <p className="text-sm font-medium">Available</p>
                <p className="text-xs text-neutral-500">Show this item on the menu</p>
              </div>
              <button
                type="button"
                onClick={() => setField('isAvailable', !form.isAvailable)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isAvailable ? 'bg-brand-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className={labelClass}>Item Image</label>
            <div className="space-y-3">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setImageFile(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <ImageIcon className="w-8 h-8 text-neutral-400 mb-2" />
                  <span className="text-sm text-neutral-500">Click to upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {/* Variations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Variations</h3>
                <p className="text-xs text-neutral-500">e.g. Small, Medium, Large</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVariation}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            {form.variations.length === 0 && (
              <p className="text-sm text-neutral-400 italic">No variations</p>
            )}
            <div className="space-y-2">
              {form.variations.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={v.name} onChange={e => updateVariation(i, 'name', e.target.value)} placeholder="Name (e.g. Large)" className="flex-1" />
                  <Input type="number" value={v.priceOverride} onChange={e => updateVariation(i, 'priceOverride', parseFloat(e.target.value) || 0)} placeholder="Price" className="w-28" />
                  <button type="button" onClick={() => removeVariation(i)} className="p-2 text-neutral-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Add-ons</h3>
                <p className="text-xs text-neutral-500">e.g. Extra cheese, Sauce</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAddOn}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            {form.addOns.length === 0 && (
              <p className="text-sm text-neutral-400 italic">No add-ons</p>
            )}
            <div className="space-y-2">
              {form.addOns.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={a.name} onChange={e => updateAddOn(i, 'name', e.target.value)} placeholder="Name (e.g. Extra Cheese)" className="flex-1" />
                  <Input type="number" value={a.additionalPrice} onChange={e => updateAddOn(i, 'additionalPrice', parseFloat(e.target.value) || 0)} placeholder="+Price" className="w-28" />
                  <button type="button" onClick={() => removeAddOn(i)} className="p-2 text-neutral-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end space-x-3 shrink-0">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Item'}
          </Button>
        </div>
      </div>
    </>
  );
}
