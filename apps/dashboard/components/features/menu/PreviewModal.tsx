'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React from 'react';
import { X, Utensils } from 'lucide-react';

interface PreviewModalProps {
  categories: any[];
  items: any[];
  onClose: () => void;
}

export function PreviewModal({ categories, items, onClose }: PreviewModalProps) {
  // Group items by category
  const allCategories = categories.map((cat) => ({
    ...cat,
    items: items.filter((item) => item.categoryId === cat.id && item.isAvailable),
  })).filter((cat) => cat.items.length > 0);

  // Items without category or uncategorized
  const uncategorized = items.filter(
    (item) => item.isAvailable && !categories.find((c) => c.id === item.categoryId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="font-black text-white text-base">Menu Preview</h2>
            <p className="text-xs text-slate-400 mt-0.5">As displayed on POS terminals — available items only</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {allCategories.length === 0 && uncategorized.length === 0 ? (
            <div className="text-center py-16">
              <Utensils size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">No available items to preview</p>
              <p className="text-slate-500 text-xs mt-1">Mark items as available to see them here</p>
            </div>
          ) : (
            <>
              {allCategories.map((cat) => (
                <div key={cat.id}>
                  <h3 className="text-xs font-black text-[#ff5722] uppercase tracking-widest mb-3 pb-1.5 border-b border-slate-700">
                    {cat.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {cat.items.map((item: any) => (
                      <PreviewCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-slate-700">
                    Other Items
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {uncategorized.map((item) => (
                      <PreviewCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {items.filter((i) => i.isAvailable).length} available items across {allCategories.length} categories
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ item }: { item: any }) {
  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden flex gap-3">
      <div className="w-16 h-16 shrink-0 bg-slate-700 flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Utensils size={18} className="text-slate-500" />
        )}
      </div>
      <div className="flex-1 p-2.5 min-w-0">
        <p className="text-xs font-bold text-white truncate">{item.name}</p>
        {item.description && (
          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-black text-[#ff5722]">
            {formatPKR(Number(item.basePrice))}
          </span>
          {item.variations?.length > 0 && (
            <span className="text-[9px] text-slate-500">{item.variations.length} sizes</span>
          )}
        </div>
      </div>
    </div>
  );
}
