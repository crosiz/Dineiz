'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useState } from 'react';
import { Pencil, Trash2, Loader2, Copy, MoreVertical, Utensils } from 'lucide-react';
import { useToggleAvailability, useDeleteItem, useDuplicateItem } from './hooks/useMenuQueries';
import { useDashboardContext } from '@/contexts/dashboard-context';

const categoryColors = [
  'bg-blue-50 text-blue-600',
  'bg-emerald-50 text-emerald-600',
  'bg-purple-50 text-purple-600',
  'bg-amber-50 text-amber-600',
  'bg-pink-50 text-pink-600',
  'bg-indigo-50 text-indigo-600',
  'bg-rose-50 text-rose-600',
  'bg-cyan-50 text-cyan-600',
];

function getCategoryColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % categoryColors.length;
  return categoryColors[index];
}

interface MenuItemCardProps {
  item: any;
  isSelected: boolean;
  onClick: () => void;
  isAdmin?: boolean;
  onMutate?: () => void;
  isReadOnly?: boolean;
}

export function MenuItemCard({ item, isSelected, onClick, isAdmin = true, onMutate, isReadOnly }: MenuItemCardProps) {
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
      { onSuccess: () => onMutate?.() }
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this item?')) {
      deleteItem.mutate(item.id, { onSuccess: () => onMutate?.() });
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    duplicate.mutate(item.id, { onSuccess: () => onMutate?.() });
  };

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all relative flex flex-col h-[320px] ${
        isReadOnly ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
      } ${
        isSelected
          ? 'ring-2 ring-[#ff5722] shadow-md'
          : 'border border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
      onClick={isReadOnly ? undefined : onClick}
    >
      {/* Image */}
      <div className="relative h-[140px] bg-slate-50 shrink-0 border-b border-slate-100">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils size={24} className="text-slate-300" />
          </div>
        )}

        {/* Availability badge overlay */}
        <div className="absolute top-2 left-2">
          <button
            onClick={handleToggle}
            disabled={toggleAvailability.isPending || isReadOnly}
            className={`text-[9px] font-black rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm ${
              toggleAvailability.isPending || isReadOnly
                ? 'bg-slate-400 text-white opacity-75'
                : item.isAvailable
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            } ${isReadOnly ? 'cursor-not-allowed' : ''}`}
            title={isReadOnly ? 'Cannot toggle availability in "All Branches" view' : item.isAvailable ? 'Click to mark unavailable' : 'Click to mark available'}
          >
            {toggleAvailability.isPending ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            )}
            {toggleAvailability.isPending
              ? 'UPDATING'
              : item.isAvailable
              ? 'AVAILABLE'
              : 'UNAVAILABLE'}
          </button>
        </div>

        {/* 3-dot menu (admin only) */}
        {isAdmin && !isReadOnly && (
          <div
            className="absolute top-2 right-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <MoreVertical size={12} className="text-slate-600" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 bg-white rounded-lg shadow-lg border border-slate-100 py-1 w-32 text-xs">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onClick();
                    }}
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    onClick={handleDuplicate}
                  >
                    {duplicate.isPending
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Copy size={11} />
                    }
                    Duplicate
                  </button>
                  <div className="h-px bg-slate-100 my-0.5" />
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-red-600 hover:bg-red-50"
                    onClick={handleDelete}
                  >
                    {deleteItem.isPending
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Trash2 size={11} />
                    }
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-[15px] text-slate-900 leading-tight line-clamp-1 flex-1" title={item.name}>
            {item.name}
          </h3>
          <span className="font-bold text-[#ff5722] text-sm shrink-0">
            {formatPKR(Number(item.basePrice))}
          </span>
        </div>

        {/* Category pill */}
        {item.category?.name && (
          <div className="mb-2">
            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getCategoryColor(item.category.name)}`}>
              {item.category.name}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
          {item.description || 'No description.'}
        </p>

        {/* Footer: toggle switch + variations count */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={toggleAvailability.isPending || isReadOnly}
              onClick={handleToggle}
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
                item.isAvailable ? 'bg-green-500' : 'bg-slate-200'
              } ${(toggleAvailability.isPending || isReadOnly) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${
                  item.isAvailable ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-[10px] text-slate-400">
              {item.isAvailable ? 'On' : 'Off'}
            </span>
          </div>

          {(item.variations?.length ?? 0) > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              {item.variations.length} variation{item.variations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
