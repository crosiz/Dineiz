'use client';

import { useState } from 'react';
import { useUser } from '@/contexts/user-context';
import { useCategories, useMenuItems, useToggleAvailability, useToggleCategoryAvailability } from '@/components/features/menu/hooks/useMenuQueries';
import { Spinner } from '@/components/ui/Spinner';

/** Branch-scoped view: a branch manager can toggle whether items/categories
 * are sellable at their branch today, but can't add, edit price, or delete —
 * that stays in the tenant-admin Menu screen. */
export default function MenuAvailabilityPage() {
  const { tenantId, branchId } = useUser();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(tenantId, branchId);
  const { data: itemsData, isLoading: itemsLoading } = useMenuItems({
    tenantId,
    branchId,
    categoryId: activeCategoryId || undefined,
  });
  const categories: any[] = (categoriesData as any[]) ?? [];
  const items: any[] = (itemsData as any[]) ?? [];

  const toggleItem = useToggleAvailability();
  const toggleCategory = useToggleCategoryAvailability();

  const isLoading = categoriesLoading || itemsLoading;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Menu Availability</h1>
        <p className="text-slate-500 text-sm mt-1">
          Turn items off when you run out — changes apply to this branch only and take effect immediately on the POS and QR menu.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            activeCategoryId === null
              ? 'bg-[#ff5722] text-white border-[#ff5722]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          All items
        </button>
        {categories.map((c: any) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveCategoryId(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategoryId === c.id
                  ? 'bg-[#ff5722] text-white border-[#ff5722]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {c.name}
            </button>
            <button
              onClick={() =>
                toggleCategory.mutate({ categoryId: c.id, data: { isAvailable: !(c.isAvailable ?? true), branchId } })
              }
              title={c.isAvailable === false ? 'Category hidden at this branch — click to restore' : 'Hide entire category at this branch'}
              className={`w-2 h-2 rounded-full shrink-0 ${c.isAvailable === false ? 'bg-red-400' : 'bg-emerald-400'}`}
            />
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-12"><Spinner size={16} />Loading menu…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-slate-400 py-12 text-center">No items in this category.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.category?.name}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.isAvailable !== false}
                aria-label={`${item.name} available`}
                onClick={() => toggleItem.mutate({ id: item.id, isAvailable: !(item.isAvailable !== false), branchId })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  item.isAvailable !== false ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    item.isAvailable !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
