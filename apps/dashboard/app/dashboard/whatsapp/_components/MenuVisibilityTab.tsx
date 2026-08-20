'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';
import { PageLoader } from '@/components/ui/Spinner';

interface Category {
  id: string;
  name: string;
  items?: { id: string }[];
}

export function MenuVisibilityTab({ config, onRefresh }: { config: any; onRefresh: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [showFullMenu, setShowFullMenu] = useState((config?.visibleCategoryIds || []).length === 0);
  const [selected, setSelected] = useState<string[]>(config?.visibleCategoryIds || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Category[]>('/api/menu')
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingMenu(false));
  }, []);

  const toggleCategory = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify({ visibleCategoryIds: showFullMenu ? [] : selected }),
      });
      alert('Menu visibility saved');
      onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to save menu visibility');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Menu Visibility</h2>
        <p className="text-sm text-gray-500 mb-4">Choose which categories customers can order from WhatsApp. Item availability still respects each branch's own menu settings.</p>

        <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4 mb-4">
          <div>
            <p className="font-semibold text-gray-900">Show complete menu</p>
            <p className="text-xs text-gray-400">When off, pick specific categories below.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={showFullMenu}
              onChange={(e) => setShowFullMenu(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
          </label>
        </div>

        {!showFullMenu && (
          loadingMenu ? (
            <PageLoader label="Loading categories..." className="min-h-0 py-8" />
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-400">No categories found. Add menu categories first.</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{cat.items?.length ?? 0} items</span>
                </label>
              ))}
            </div>
          )
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Menu Visibility'}
        </Button>
      </div>
    </div>
  );
}
