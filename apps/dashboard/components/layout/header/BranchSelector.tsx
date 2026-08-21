'use client';

import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranches } from '@/hooks/useBranches';
import { MapPin as BranchIcon, ChevronDown as ChevronDownIcon } from 'lucide-react';

export function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId, userRole, userBranchId } = useDashboardContext();
  const { data: branches } = useBranches();

  const isTenantAdmin = userRole === 'TENANT_ADMIN' || userRole === 'SUPER_ADMIN';
  const isBranchManager = userRole === 'BRANCH_MANAGER';

  // ── Branch Manager: static text, no interaction ───────────────────────────
  if (isBranchManager) {
    const branchName = (branches as any[])?.find((b: any) => b.id === userBranchId)?.name ?? 'My Branch';
    return (
      <div className="relative flex items-center bg-white border border-gray-200 rounded-lg px-8 h-9 text-[13px] text-gray-700 select-none min-w-[160px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <BranchIcon className="w-4 h-4 text-gray-400" />
        </span>
        <span className="font-medium">{branchName}</span>
      </div>
    );
  }

  if (!isTenantAdmin) return null;

  return (
    <div className="relative">
      <select
        value={selectedBranchId || ''}
        onChange={(e) => {
          const selectedOption = e.target.options[e.target.selectedIndex];
          setSelectedBranchId(
            e.target.value || null,
            selectedOption.text
          );
        }}
        className="appearance-none bg-white border border-gray-200 rounded-lg
          pl-8 pr-8 h-9 text-[13px] text-gray-700 cursor-pointer
          focus:outline-none focus:border-orange-500 focus:ring-2
          focus:ring-orange-500/10 min-w-[160px]"
      >
        <option value="">All Branches</option>
        {branches?.map((branch: any) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      {/* Email/branch icon on left */}
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        <BranchIcon className="w-4 h-4 text-gray-400" />
      </span>
      {/* Chevron on right */}
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
      </span>
    </div>
  );
}

