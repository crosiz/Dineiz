'use client';

import React from 'react';
import { Search, ChevronDown, MapPin } from 'lucide-react';
import { BranchSelect } from '@/components/ui/branch-select';

export function StaffFilters({ filters, setFilters, totalResults }: { filters: any, setFilters: any, totalResults?: number }) {
  return (
    <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          value={filters.search || ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          placeholder="Name, email..." 
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-[13px] outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-400"
        />
      </div>
      
      {/* Branch filter */}
      <div className="flex items-center gap-2">
        <div className="relative w-[160px]">
          <BranchSelect
            value={filters.branchId || ''}
            onChange={(val) => setFilters({ ...filters, branchId: val || '', page: 1 })}
            includeAll={true}
            placeholder="Branch: All"
            className="h-9 rounded-lg border-slate-200 bg-white text-[13px] font-medium text-slate-700"
          />
        </div>

        <div className="relative">
          <select 
            value={filters.role || ''}
            onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
            className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="">Role: All</option>
            <option value="POS">POS Staff</option>
            <option value="ATTENDANCE">Attendance Only</option>
            <option value="BRANCH_MANAGER">Branch Managers</option>
            <option value="CASHIER">Cashiers</option>
            <option value="WAITER">Waiters</option>
            <option value="KITCHEN_STAFF">Kitchen Staff</option>
            <option value="RIDER">Riders</option>
            <option value="WORKER">Workers</option>
            <option value="COOK">Cooks</option>
            <option value="GUARD">Guards</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {totalResults !== undefined && (
        <div className="ml-auto text-[13px] font-medium text-slate-500">
          <span className="font-bold text-slate-900">{totalResults}</span> results
        </div>
      )}
    </div>
  );
}

