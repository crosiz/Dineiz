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

// ─── Skeleton that exactly matches the real StaffTable columns ────────────────
function StaffTableSkeleton({ showBranchColumn }: { showBranchColumn: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
            <tr>
              <th className="w-[280px] px-6 py-4">Name</th>
              <th className="w-40 px-6 py-4">Role</th>
              {showBranchColumn && <th className="w-40 px-6 py-4">Branch</th>}
              <th className="w-32 px-6 py-4">Status</th>
              <th className="w-32 px-6 py-4">Last Active</th>
              <th className="w-32 px-6 py-4">Biometric</th>
              <th className="w-20 px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[0, 80, 160, 240, 320].map((delay) => (
              <tr key={delay} className="border-b border-slate-100">
                {/* NAME: avatar + two lines */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                    <div className="space-y-1.5">
                      <div
                        className="h-3.5 w-32 bg-slate-200 rounded animate-pulse"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                      <div
                        className="h-3 w-24 bg-slate-100 rounded animate-pulse"
                        style={{ animationDelay: `${delay + 40}ms` }}
                      />
                    </div>
                  </div>
                </td>
                {/* ROLE: pill */}
                <td className="px-6 py-4">
                  <div
                    className="h-6 w-24 bg-slate-200 rounded-full animate-pulse"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                </td>
                {/* BRANCH */}
                {showBranchColumn && (
                  <td className="px-6 py-4">
                    <div
                      className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  </td>
                )}
                {/* STATUS: dot + label */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full bg-slate-200 animate-pulse shrink-0"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                    <div
                      className="h-3.5 w-14 bg-slate-200 rounded animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  </div>
                </td>
                {/* LAST ACTIVE */}
                <td className="px-6 py-4">
                  <div
                    className="h-3.5 w-20 bg-slate-200 rounded animate-pulse"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                </td>
                {/* BIOMETRIC */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded bg-slate-200 animate-pulse shrink-0"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                    <div
                      className="h-3.5 w-16 bg-slate-200 rounded animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  </div>
                </td>
                {/* ACTIONS: icon button */}
                <td className="px-6 py-4 text-right">
                  <div
                    className="h-8 w-8 bg-slate-200 rounded-lg animate-pulse ml-auto"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StaffPage() {
  const {
    staffList, pagination, stats, isLoading,
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
        {isLoading ? (
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
