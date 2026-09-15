'use client';

import React, { useMemo, useState } from 'react';
import { Search, List, LayoutGrid, MoreVertical, Pencil, Trash2, Copy, Loader2, Utensils, Check, X } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { MenuItemCard } from './MenuItemCard';
import {
  useToggleAvailability,
  useDeleteItem,
  useDuplicateItem,
  useBulkItemAvailability,
} from './hooks/useMenuQueries';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { ErrorState } from '@/components/ui/ErrorState';

interface MenuItemGridProps {
  items: any[];
  search: string;
  setSearch: (s: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (v: 'grid' | 'list') => void;
  availabilityFilter: string;
  setAvailabilityFilter: (a: string) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAddItem: () => void;
  isAdmin: boolean;
  onMutate?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isReadOnly?: boolean;
  categoryName?: string | null;
  categoryDescription?: string | null;
}

function AvailabilityToggle({ item, onMutate, isReadOnly }: { item: any; onMutate?: () => void; isReadOnly?: boolean }) {
  const { selectedBranchId } = useDashboardContext();
  const toggle = useToggleAvailability();
  return (
    <button
      type="button"
      disabled={toggle.isPending || isReadOnly}
      onClick={(e) => {
        e.stopPropagation();
        if (isReadOnly) return;
        toggle.mutate(
          { id: item.id, isAvailable: !item.isAvailable, branchId: selectedBranchId },
          { onSuccess: () => onMutate?.() },
        );
      }}
      className={`relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0 ${
        item.isAvailable ? 'bg-green-500' : 'bg-slate-200'
      } ${toggle.isPending || isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      aria-label={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${
          item.isAvailable ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function RowCheckbox({ checked, active, onToggle }: { checked: boolean; active: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(e); }}
      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
        checked
          ? 'bg-[#ff5722] border-[#ff5722] text-white'
          : `bg-white border-slate-300 text-transparent ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
      }`}
      aria-label={checked ? 'Deselect item' : 'Select item'}
    >
      <Check size={13} strokeWidth={3} />
    </button>
  );
}

function ListItemRow({
  item,
  isSelected,
  onSelect,
  isAdmin,
  onMutate,
  isReadOnly,
  checked,
  selectionActive,
  onToggleCheck,
}: {
  item: any;
  isSelected: boolean;
  onSelect: () => void;
  isAdmin: boolean;
  onMutate?: () => void;
  isReadOnly?: boolean;
  checked: boolean;
  selectionActive: boolean;
  onToggleCheck: (e: React.MouseEvent) => void;
}) {
  const deleteItem = useDeleteItem();
  const duplicate = useDuplicateItem();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (window.confirm(`Delete "${item.name}"?`)) {
      deleteItem.mutate(item.id, { onSuccess: () => onMutate?.() });
    }
  };

  return (
    <div
      onClick={isReadOnly ? undefined : onSelect}
      className={`group flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 transition-colors ${
        isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'
      } ${isSelected ? 'bg-orange-50' : ''}`}
    >
      {isAdmin && !isReadOnly ? (
        <RowCheckbox checked={checked} active={selectionActive} onToggle={onToggleCheck} />
      ) : (
        <div className="w-5 shrink-0" />
      )}

      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <Utensils size={14} className="text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
        <p className="text-xs text-slate-400 truncate">{item.category?.name || 'Uncategorised'}</p>
      </div>

      <span className="text-sm font-medium text-slate-900 shrink-0 tabular-nums w-24 text-right">
        {formatPKR(Number(item.basePrice))}
      </span>

      <span className="text-xs text-slate-400 shrink-0 w-14 text-center">
        {item.variations?.length ?? 0}
      </span>

      <div onClick={(e) => e.stopPropagation()} className="w-10 flex justify-center">
        <AvailabilityToggle item={item} onMutate={onMutate} isReadOnly={isReadOnly} />
      </div>

      {isAdmin && !isReadOnly && (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Item actions"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-36 text-sm">
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={() => { setMenuOpen(false); onSelect(); }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={() => { setMenuOpen(false); duplicate.mutate(item.id, { onSuccess: () => onMutate?.() }); }}
                >
                  {duplicate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  Duplicate
                </button>
                <div className="h-px bg-slate-100 my-0.5" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MenuItemGrid({
  items,
  search,
  setSearch,
  viewMode,
  setViewMode,
  availabilityFilter,
  setAvailabilityFilter,
  selectedItemId,
  onSelectItem,
  onAddItem,
  isAdmin,
  onMutate,
  isLoading,
  isError,
  onRetry,
  isReadOnly,
  categoryName,
  categoryDescription,
}: MenuItemGridProps) {
  const { selectedBranchId } = useDashboardContext();
  const bulkAvailability = useBulkItemAvailability();
  const deleteItem = useDeleteItem();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // A fixed column count breaks down the moment the editor panel opens or the
  // sidebar takes more room — cards get squeezed and item names truncate
  // mid-word ("Chicken Karahi" -> "Chicken..."). auto-fill with a real
  // minimum card width adapts to whatever space is actually available and
  // never goes narrower than a name + price can comfortably fit.
  const cols = 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]';

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  // Drop ids that are no longer in the list (filter / category change).
  const activeSelection = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => itemIds.includes(id))),
    [selectedIds, itemIds],
  );
  const selectionActive = activeSelection.size > 0;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((x) => itemIds.includes(x)));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(itemIds));

  const selectedItems = useMemo(
    () => items.filter((i) => activeSelection.has(i.id)),
    [items, activeSelection],
  );
  // Only offer an action that would actually change something — marking an
  // already-unavailable selection "unavailable" again is a no-op, and
  // showing it anyway is exactly the kind of dead button that makes bulk
  // actions confusing.
  const canMarkAvailable = selectedItems.some((i) => !i.isAvailable);
  const canMarkUnavailable = selectedItems.some((i) => i.isAvailable);

  const [pendingAction, setPendingAction] = useState<'available' | 'unavailable' | 'delete' | null>(null);

  const runBulkAvailability = (isAvailable: boolean) => {
    setPendingAction(isAvailable ? 'available' : 'unavailable');
    bulkAvailability.mutate(
      { itemIds: Array.from(activeSelection), isAvailable, branchId: selectedBranchId },
      { onSettled: () => setPendingAction(null), onSuccess: () => { onMutate?.(); clearSelection(); } },
    );
  };

  const runBulkDelete = async () => {
    const ids = Array.from(activeSelection);
    if (!window.confirm(`Delete ${ids.length} item${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setPendingAction('delete');
    await Promise.allSettled(ids.map((id) => deleteItem.mutateAsync(id)));
    setPendingAction(null);
    onMutate?.();
    clearSelection();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-slate-200 bg-white shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-slate-400"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="h-9 rounded-lg border border-slate-200 bg-white text-sm px-3 text-slate-700 focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
        >
          <option value="all">All items</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>

        <div className="flex-1" />

        <span className="text-xs text-slate-400 shrink-0">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden shrink-0">
          <button
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={`p-2 border-l border-slate-200 transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Category context / bulk action bar */}
      {selectionActive ? (
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center gap-3 text-sm">
          <button onClick={clearSelection} className="p-1 -ml-1 text-slate-400 hover:text-slate-600" aria-label="Clear selection">
            <X size={16} />
          </button>
          <span className="font-medium text-slate-700">
            <span className="text-[#ff5722] tabular-nums">{activeSelection.size}</span> selected
          </span>
          {activeSelection.size < items.length && (
            <button onClick={selectAllVisible} className="text-slate-500 hover:text-slate-700 underline underline-offset-2">
              Select all {items.length}
            </button>
          )}
          <div className="flex-1" />
          {canMarkAvailable && (
            <button
              onClick={() => runBulkAvailability(true)}
              disabled={pendingAction !== null}
              className="px-3 h-8 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5"
            >
              {pendingAction === 'available' && <Loader2 size={13} className="animate-spin" />}
              Mark available
            </button>
          )}
          {canMarkUnavailable && (
            <button
              onClick={() => runBulkAvailability(false)}
              disabled={pendingAction !== null}
              className="px-3 h-8 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5"
            >
              {pendingAction === 'unavailable' && <Loader2 size={13} className="animate-spin" />}
              Mark unavailable
            </button>
          )}
          <button
            onClick={runBulkDelete}
            disabled={pendingAction !== null}
            className="px-3 h-8 rounded-lg border border-red-200 bg-white font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 flex items-center gap-1.5"
          >
            {pendingAction === 'delete' && <Loader2 size={13} className="animate-spin" />}
            Delete
          </button>
        </div>
      ) : (
        categoryName && (
          <div className="px-5 py-2 bg-white border-b border-slate-100 shrink-0">
            <span className="text-sm font-medium text-slate-700">{categoryName}</span>
            {categoryDescription && <span className="text-sm text-slate-400"> — {categoryDescription}</span>}
          </div>
        )
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isError ? (
          <ErrorState message="Couldn't load menu items." onRetry={onRetry} />
        ) : isLoading ? (
          <div className={`p-5 grid gap-4 ${viewMode === 'grid' ? cols : 'grid-cols-1'}`}>
            {[1, 2, 3, 4, 5, 6].map((i) =>
              viewMode === 'grid' ? (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-3.5 space-y-2">
                  <div className="h-3.5 skeleton-shimmer rounded w-3/4" />
                  <div className="h-2.5 skeleton-shimmer rounded w-1/2 mt-2" />
                  <div className="h-2.5 skeleton-shimmer rounded w-full mt-3" />
                  <div className="h-4 skeleton-shimmer rounded w-16 mt-4" />
                </div>
              ) : (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
                  <div className="w-9 h-9 skeleton-shimmer rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 skeleton-shimmer rounded w-2/3" />
                    <div className="h-2 skeleton-shimmer rounded w-1/3" />
                  </div>
                </div>
              ),
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-10">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
              <Utensils size={24} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {search ? 'No matching items' : 'No items here yet'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {search ? `Nothing matches "${search}"` : 'Add your first item to this category'}
              </p>
            </div>
            {isAdmin && !search && !isReadOnly && (
              <button
                onClick={onAddItem}
                className="mt-1 px-4 py-2 bg-[#ff5722] hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Add item
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`p-5 grid gap-4 ${cols}`}>
            {items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onClick={() => onSelectItem(item.id === selectedItemId ? null : item.id)}
                isAdmin={isAdmin}
                onMutate={onMutate}
                isReadOnly={isReadOnly}
                checked={activeSelection.has(item.id)}
                selectionActive={selectionActive}
                onToggleCheck={() => toggleId(item.id)}
              />
            ))}
          </div>
        ) : (
          <div>
            <div className="group flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 sticky top-0 z-[1]">
              <div className="w-5 shrink-0" />
              <div className="w-9 shrink-0" />
              <span className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Item</span>
              <span className="w-24 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Price</span>
              <span className="w-14 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sizes</span>
              <span className="w-10 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">On</span>
              {isAdmin && !isReadOnly && <div className="w-7 shrink-0" />}
            </div>
            {items.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onSelect={() => onSelectItem(item.id === selectedItemId ? null : item.id)}
                isAdmin={isAdmin}
                onMutate={onMutate}
                isReadOnly={isReadOnly}
                checked={activeSelection.has(item.id)}
                selectionActive={selectionActive}
                onToggleCheck={() => toggleId(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
