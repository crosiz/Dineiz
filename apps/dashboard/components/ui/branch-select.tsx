'use client';

import React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';

interface BranchSelectProps {
  value: string | null;
  onChange: (branchId: string | null) => void;
  placeholder?: string;
  /** Adds "All Branches" as first option (value = "all") */
  includeAll?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

function SelectSkeleton() {
  return <div className="w-full h-10 rounded-lg border border-slate-200 skeleton-shimmer" />;
}

export function BranchSelect({
  value,
  onChange,
  placeholder = 'Select Branch',
  includeAll = false,
  required = false,
  disabled = false,
  error,
  className = '',
}: BranchSelectProps) {
  const { data: branches, isLoading, isError } = useBranches();

  if (isLoading) return <SelectSkeleton />;

  if (isError) {
    return (
      <p className="text-red-500 text-sm py-2">
        Failed to load branches. Please refresh the page.
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="relative">
        <select
          required={required}
          disabled={disabled}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className={[
            'w-full h-10 pl-4 pr-10 rounded-xl border text-sm appearance-none cursor-pointer outline-none transition-colors',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
              : 'border-slate-200 focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100',
            disabled
              ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-900 hover:border-slate-300',
          ].join(' ')}
        >
          <option value="">{placeholder}</option>
          {includeAll && <option value="all">All Branches</option>}
          {(branches ?? []).map((branch: any) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}{branch.city ? ` — ${branch.city}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
