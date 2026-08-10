'use client';

import React from 'react';
import { Search, Download, ChevronDown } from 'lucide-react';

// Branch context is provided by the header BranchSelector (DashboardContext).
// This filter bar intentionally has no branch dropdown.

export function InventoryFilters() {
  return (
    <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search by name or category..." 
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-[13px] outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-400"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="relative">
          <select className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors">
            <option value="">Status: All</option>
            <option value="HEALTHY">Healthy</option>
            <option value="LOW STOCK">Low Stock</option>
            <option value="OUT OF STOCK">Out of Stock</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors">
            <option value="az">Sort: A-Z</option>
            <option value="za">Sort: Z-A</option>
            <option value="stock-asc">Stock: Low to High</option>
            <option value="stock-desc">Stock: High to Low</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors shrink-0">
          <Download size={15} />
        </button>
      </div>

      <div className="ml-auto text-[13px] font-medium text-slate-500">
        <span className="font-bold text-slate-900">0</span> results
      </div>
    </div>
  );
}
