'use client';

import React from 'react';
import { useStaff } from './hooks/useStaff';
import { StaffStatsBar } from './StaffStatsBar';
import { StaffFilters } from './StaffFilters';
import { StaffTable } from './StaffTable';
import { AddStaffModal } from './modals/AddStaffModal';
import { Plus } from 'lucide-react';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { AllBranchesBanner } from '@/components/AllBranchesBanner';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonTable } from '@/components/ui/skeleton';

// ─── Skeleton that tracks the real StaffTable columns ────────────────────────
function StaffTableSkeleton({ showBranchColumn }: { showBranchColumn: boolean }) {
  return (
    <SkeletonTable
      className="!border-slate-100 shadow-sm"
      rows={6}
      columns={[
        { w: 150, avatar: true },
        { w: 88, pill: true },
        ...(showBranchColumn ? [{ w: 72, pill: true } as const] : []),
        88,
        72,
        88,
        { w: 32, align: 'right' as const },
      ]}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StaffPage() {
  const {
    staffList, pagination, stats, isLoading, isError, refetch,
    isAddModalOpen, setIsAddModalOpen,
    filters, setFilters,
  } = useStaff();
  const { isAllBranches } = useBranchFilter();

  return (
    <div className="p-6 max-w-7xl mx-auto pb-20">
      <AllBranchesBanner isAllBranches={isAllBranches} />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff &amp; Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track across all branches</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#ff5722] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add Staff Member
        </button>
      </div>

      <StaffStatsBar stats={stats} />

      <StaffFilters filters={filters} setFilters={setFilters} totalResults={pagination.total} />

      <div className="min-h-[500px]">
        {isError ? (
          <ErrorState message="Couldn't load staff." onRetry={refetch} />
        ) : isLoading ? (
          <StaffTableSkeleton showBranchColumn={isAllBranches} />
        ) : (
          <StaffTable
            staffList={staffList}
            pagination={pagination}
            filters={filters}
            setFilters={setFilters}
          />
        )}
      </div>

      <AddStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
