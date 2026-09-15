'use client';

import React from 'react';
import { X, Utensils } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

interface PreviewModalProps {
  categories: any[];
  items: any[];
  branchName?: string;
  onClose: () => void;
}

export function PreviewModal({ categories, items, branchName, onClose }: PreviewModalProps) {
  const grouped = categories
    .map((cat) => ({ ...cat, items: items.filter((i) => i.categoryId === cat.id && i.isAvailable) }))
    .filter((cat) => cat.items.length > 0);

  const uncategorised = items.filter(
    (i) => i.isAvailable && !categories.find((c) => c.id === i.categoryId),
  );

  const availableCount = items.filter((i) => i.isAvailable).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Menu preview</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              What the POS shows{branchName ? ` for ${branchName}` : ''} — available items only
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

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {grouped.length === 0 && uncategorised.length === 0 ? (
            <div className="text-center py-16">
              <Utensils size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Nothing to preview yet</p>
              <p className="text-sm text-slate-500 mt-1">Mark items as available to see them here</p>
            </div>
          ) : (
            <>
              {grouped.map((cat) => (
                <div key={cat.id}>
                  <h3 className="text-[11px] font-bold text-[#ff5722] uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-200">
                    {cat.name}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cat.items.map((item: any) => (
                      <PreviewCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
              {uncategorised.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-200">
                    Other items
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uncategorised.map((item) => (
                      <PreviewCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {availableCount} available item{availableCount !== 1 ? 's' : ''} across {grouped.length} categor{grouped.length !== 1 ? 'ies' : 'y'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ item }: { item: any }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex gap-3">
      <div className="w-16 h-16 shrink-0 bg-slate-100 flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <Utensils size={18} className="text-slate-300" />
        )}
      </div>
      <div className="flex-1 p-2.5 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatPKR(Number(item.basePrice))}</span>
          {item.variations?.length > 0 && (
            <span className="text-[11px] text-slate-400">{item.variations.length} sizes</span>
          )}
        </div>
      </div>
    </div>
  );
}
