'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@swiftserve/ui/src/components/button';
import { Input } from '@swiftserve/ui/src/components/input';
import { toast } from 'sonner';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categoryToEdit: { id: string; name: string; description?: string; sortOrder?: number } | null;
};

export default function CategorySlideOver({ isOpen, onClose, onSuccess, categoryToEdit }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name);
      setDescription(categoryToEdit.description || '');
      setSortOrder(categoryToEdit.sortOrder || 0);
    } else {
      setName('');
      setDescription('');
      setSortOrder(0);
      setAvailable(true);
    }
    setError('');
  }, [categoryToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Category name is required'); return; }
    setLoading(true);
    setError('');

    try {
      const url = categoryToEdit
        ? `http://localhost:8080/api/menu/categories/${categoryToEdit.id}`
        : 'http://localhost:8080/api/menu/categories';
      const method = categoryToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), sortOrder, isAvailable: available }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save category'); return; }

      toast.success(categoryToEdit ? 'Category updated' : 'Category created');
      onSuccess();
      onClose();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">{categoryToEdit ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Category Name <span className="text-red-500">*</span></label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Burgers"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:border-neutral-800 dark:focus-visible:ring-neutral-300"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Sort Order</label>
            <Input
              type="number"
              min={0}
              value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))}
            />
            <p className="text-xs text-neutral-500">Lower numbers appear first</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-neutral-500">Show this category on the menu</p>
            </div>
            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${available ? 'bg-brand-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${available ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Category'}
          </Button>
        </div>
      </div>
    </>
  );
}
