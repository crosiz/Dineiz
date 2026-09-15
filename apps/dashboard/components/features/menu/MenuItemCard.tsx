'use client';

import React, { useState } from 'react';
import { Pencil, Trash2, Loader2, Copy, MoreVertical, Check, MapPin } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';
import { useToggleAvailability, useDeleteItem, useDuplicateItem } from './hooks/useMenuQueries';
import { useDashboardContext } from '@/contexts/dashboard-context';

interface MenuItemCardProps {
  item: any;
  isSelected: boolean;
  onClick: () => void;
  isAdmin?: boolean;
  onMutate?: () => void;
  isReadOnly?: boolean;
  checked?: boolean;
  selectionActive?: boolean;
  onToggleCheck?: (e: React.MouseEvent) => void;
}

function metaLine(item: any): string {
  const parts: string[] = [];
  const v = item.variations?.length ?? 0;
  const a = item.addOns?.length ?? 0;
  if (v) parts.push(`${v} size${v !== 1 ? 's' : ''}`);
  if (a) parts.push(`${a} add-on${a !== 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export function MenuItemCard({
  item,
  isSelected,
  onClick,
  isAdmin = true,
  onMutate,
  isReadOnly,
  checked = false,
  selectionActive = false,
  onToggleCheck,
}: MenuItemCardProps) {
  const { selectedBranchId } = useDashboardContext();
  const toggleAvailability = useToggleAvailability();
  const deleteItem = useDeleteItem();
  const duplicate = useDuplicateItem();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    toggleAvailability.mutate(
      { id: item.id, isAvailable: !item.isAvailable, branchId: selectedBranchId },
      { onSuccess: () => onMutate?.() },
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (window.confirm(`Delete "${item.name}"?`)) {
      deleteItem.mutate(item.id, { onSuccess: () => onMutate?.() });
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    duplicate.mutate(item.id, { onSuccess: () => onMutate?.() });
  };

  const meta = metaLine(item);
  const hasOverride = item.branchOverridePrice != null;

  return (
    <div
      className={`group relative bg-white rounded-xl border transition-colors flex flex-col ${
        isReadOnly ? 'cursor-default' : 'cursor-pointer'
      } ${
        isSelected
          ? 'border-[#ff5722] ring-1 ring-[#ff5722]'
          : checked
            ? 'border-[#ff5722]/60'
            : 'border-slate-200 hover:border-slate-300'
      }`}
      onClick={isReadOnly ? undefined : onClick}
    >
      {item.image && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-xl bg-slate-50 border-b border-slate-100">
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3.5 flex items-start gap-2.5 flex-1">
        {/* Selection checkbox — its own column, so it can never sit on top of the title */}
        {isAdmin && !isReadOnly && onToggleCheck && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCheck(e); }}
            className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-md border flex items-center justify-center transition-all ${
              checked
                ? 'bg-[#ff5722] border-[#ff5722] text-white'
                : `bg-white border-slate-300 text-transparent ${selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
            }`}
            aria-label={checked ? 'Deselect item' : 'Select item'}
          >
            <Check size={12} strokeWidth={3} />
          </button>
        )}

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1 min-w-0" title={item.name}>
              {item.name}
            </h3>
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 shrink-0 tabular-nums">
              {hasOverride && <MapPin size={11} className="text-[#ff5722]" aria-label="Branch price" />}
              {formatPKR(Number(item.basePrice))}
            </span>
          </div>

          <p className="text-xs text-slate-500 line-clamp-1">
            {item.category?.name || 'Uncategorised'}
            {meta && <span className="text-slate-400"> · {meta}</span>}
          </p>

          {item.description && (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
          )}

          <div className="mt-auto pt-2.5 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={toggleAvailability.isPending || isReadOnly}
                onClick={handleToggle}
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
                  item.isAvailable ? 'bg-green-500' : 'bg-slate-200'
                } ${toggleAvailability.isPending || isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-label={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${
                    item.isAvailable ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-slate-500">
                {toggleAvailability.isPending ? 'Saving…' : item.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>

            {isAdmin && !isReadOnly && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  className="p-1 -mr-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick(); }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                        onClick={handleDuplicate}
                      >
                        {duplicate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                        Duplicate
                      </button>
                      <div className="h-px bg-slate-100 my-0.5" />
                      <button
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50"
                        onClick={handleDelete}
                      >
                        {deleteItem.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
