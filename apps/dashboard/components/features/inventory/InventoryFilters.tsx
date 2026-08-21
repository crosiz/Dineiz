'use client';

import React from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { InventoryFilterState } from './hooks/useInventory';

// Branch context is provided by the header BranchSelector (DashboardContext).
// This filter bar intentionally has no branch dropdown.

interface InventoryFiltersProps {
  filters: InventoryFilterState;
  onChange: (filters: InventoryFilterState) => void;
  resultCount: number;
}

export function InventoryFilters({ filters, onChange, resultCount }: InventoryFiltersProps) {
  return (
    <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by name or category..."
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-[13px] outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <option value="">Status: All</option>
            <option value="HEALTHY">Healthy</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="OVERSTOCKED">Overstocked</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value })}
            className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <option value="">Sort: Problems First</option>
            <option value="name_asc">Sort: A-Z</option>
            <option value="name_desc">Sort: Z-A</option>
            <option value="stock_asc">Stock: Low to High</option>
            <option value="stock_desc">Stock: High to Low</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="ml-auto text-[13px] font-medium text-slate-500">
        <span className="font-bold text-slate-900">{resultCount}</span> results
      </div>
    </div>
  );
}
