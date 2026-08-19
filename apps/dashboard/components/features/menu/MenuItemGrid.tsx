'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React from 'react';
import { Search, List, Grid, MoreHorizontal, Pencil, Trash2, Copy, Loader2, Utensils } from 'lucide-react';
import { MenuItemCard } from './MenuItemCard';
import { useToggleAvailability, useDeleteItem, useDuplicateItem } from './hooks/useMenuQueries';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { ErrorState } from '@/components/ui/ErrorState';

interface MenuItemGridProps {
  items: any[];
  categories: any[];
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
  panelOpen?: boolean;
  isReadOnly?: boolean;
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
          { onSuccess: () => onMutate?.() }
        );
      }}
      className={`relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0 ${
        item.isAvailable ? 'bg-green-500' : 'bg-slate-200'
      } ${(toggle.isPending || isReadOnly) ? 'opacity-60 cursor-not-allowed' : ''}`}
      title={isReadOnly ? 'Cannot toggle availability in "All Branches" view' : item.isAvailable ? 'Mark unavailable' : 'Mark available'}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${
          item.isAvailable ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
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
}: {
  item: any;
  isSelected: boolean;
  onSelect: () => void;
  isAdmin: boolean;
  onMutate?: () => void;
  isReadOnly?: boolean;
}) {
  const deleteItem = useDeleteItem();
  const duplicate = useDuplicateItem();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this item?')) {
      deleteItem.mutate(item.id, { onSuccess: () => onMutate?.() });
    }
  };

  return (
    <div
      onClick={isReadOnly ? undefined : onSelect}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 transition-colors ${
        isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'
      } ${
        isSelected ? 'bg-orange-50 border-l-2 border-l-[#ff5722]' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Utensils size={14} className="text-slate-300" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{item.category?.name || '—'}</p>
      </div>

      {/* Price */}
      <span className="text-xs font-bold text-[#ff5722] shrink-0">
        {formatPKR(Number(item.basePrice))}
      </span>

      {/* Variations count */}
      <span className="text-[10px] text-slate-400 shrink-0 w-14 text-center">
        {item.variations?.length ?? 0} var.
      </span>

      {/* Availability */}
      <div onClick={(e) => e.stopPropagation()}>
        <AvailabilityToggle item={item} onMutate={onMutate} isReadOnly={isReadOnly} />
      </div>

      {/* Actions */}
      {isAdmin && !isReadOnly && (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 bg-white rounded-lg shadow-lg border border-slate-100 py-1 w-36 text-xs">
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={() => { setMenuOpen(false); onSelect(); }}
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false);
                    duplicate.mutate(item.id, { onSuccess: () => onMutate?.() });
                  }}
                >
                  {duplicate.isPending ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
                  Duplicate
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                >
                  <Trash2 size={11} /> Delete
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
  categories,
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
  panelOpen,
  isReadOnly,
}: MenuItemGridProps) {
  const cols = panelOpen
    ? 'grid-cols-1 lg:grid-cols-2'
    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-slate-200 bg-white shrink-0 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] outline-none shadow-sm placeholder:text-slate-400"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] text-slate-700 shrink-0 cursor-pointer shadow-sm"
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
        >
          <option value="all">All Availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>

        <div className="flex-1" /> {/* Spacer */}

        <span className="text-xs text-slate-400 font-medium shrink-0">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0 border border-slate-200 shadow-inner">
          <button
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white shadow text-[#ff5722]' : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setViewMode('grid')}
          >
            <Grid size={14} />
          </button>
          <button
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-white shadow text-[#ff5722]' : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isError ? (
          <ErrorState message="Couldn't load menu items." onRetry={onRetry} />
        ) : isLoading ? (
          <div className={`p-5 grid gap-3 ${viewMode === 'grid' ? cols : 'grid-cols-1'}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              viewMode === 'grid' ? (
                <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden animate-pulse">
                  <div className="h-32 bg-slate-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                    <div className="h-2 bg-slate-100 rounded w-full mt-1" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 animate-pulse">
                  <div className="w-9 h-9 bg-slate-100 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                    <div className="h-2 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              )
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 p-10">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <Utensils size={28} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium text-slate-700">
                {search ? 'No results found' : 'No items in this category yet'}
              </p>
              <p className="text-[13px] text-slate-500 mt-1">
                {search ? `We couldn't find anything matching "${search}"` : 'Add your first item to this category'}
              </p>
            </div>
            {isAdmin && !search && (
              <button
                onClick={onAddItem}
                className="mt-2 px-5 py-2.5 bg-[#ff5722] hover:bg-orange-600 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
              >
                + Add Item
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`p-5 grid gap-3 ${cols}`}>
            {items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onClick={() => onSelectItem(item.id === selectedItemId ? null : item.id)}
                isAdmin={isAdmin}
                onMutate={onMutate}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        ) : (
          <div>
            {/* List header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 sticky top-0">
              <div className="w-9 shrink-0" />
              <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Price</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14 text-center">Var.</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10 text-center">Avail.</span>
              {isAdmin && !isReadOnly && <div className="w-6 shrink-0" />}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
