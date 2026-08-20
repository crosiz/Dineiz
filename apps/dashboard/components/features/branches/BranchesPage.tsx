'use client';

import React, { useState } from 'react';
import { Search, MapPin, Bell, Grid, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBranches } from './hooks/useBranches';
import { BranchCard } from './BranchCard';
import { NetworkStatusWidget } from './NetworkStatusWidget';
import { AlertWidget } from './AlertWidget';
import { AddBranchModal } from './AddBranchModal';
import { BranchDetailsSlideOver } from './BranchDetailsSlideOver';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import BranchModal from '@/app/dashboard/branches/components/BranchModal';

export function BranchesPage() {
  const { branches, summary, isLoading, error, refetch } = useBranches();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [selectedBranchForDetails, setSelectedBranchForDetails] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const router = useRouter();

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.address && b.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (b.city && b.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (b.branchCode && b.branchCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 flex flex-col min-h-[calc(100vh-64px)] bg-slate-50/50">
      {/* Top Bar (Inside Page) */}
      <div className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center px-6 lg:px-8">
        <div className="relative w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 outline-none"
            placeholder="Search branch operations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* PAGE HEADER */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Branches</h1>
              <p className="text-slate-500 text-sm">Manage your restaurant locations and branch performance.</p>
              
              <div className="flex items-center gap-3 mt-4">
                <span className="bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div> {summary.total} Total Branches
                </span>
                <span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div> {summary.active} Active
                </span>
                <span className="bg-slate-200 text-slate-600 rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-500"></div> {summary.inactive} Inactive
                </span>
                
                <div className="flex items-center gap-1 ml-4">
                  <MapPin size={12} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{summary.primaryCity}</span>
                </div>
              </div>
            </div>
            
            <button 
              className="bg-[#ff5722] text-white rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={18} />
              Add Branch
            </button>
          </div>

          {/* BRANCH CARDS GRID */}
          {error ? (
            <ErrorState message="Couldn't load branches." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 100, 200].map(delay => (
                <div key={delay} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  {/* Matches BranchCard's h-24 colour header: badge + logo + name */}
                  <div className="h-24 relative flex items-end p-4 bg-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <Skeleton className="w-11 h-11 rounded-xl shrink-0" style={{ animationDelay: `${delay}ms` }} />
                      <Skeleton className="h-4 w-28" style={{ animationDelay: `${delay}ms` }} />
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <Skeleton className="h-3 w-40" style={{ animationDelay: `${delay}ms` }} />
                    <Skeleton className="h-3 w-32" style={{ animationDelay: `${delay}ms` }} />
                    <Skeleton className="h-3 w-36" style={{ animationDelay: `${delay}ms` }} />
                    <div className="grid grid-cols-3 gap-3 pt-3 mt-1 border-t border-slate-100">
                      <Skeleton className="h-8 w-full" style={{ animationDelay: `${delay}ms` }} />
                      <Skeleton className="h-8 w-full" style={{ animationDelay: `${delay}ms` }} />
                      <Skeleton className="h-8 w-full" style={{ animationDelay: `${delay}ms` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBranches.map(branch => (
                <BranchCard 
                  key={branch.id} 
                  branch={branch} 
                  onViewDetails={() => setSelectedBranchForDetails(branch)}
                  onEdit={() => setEditingBranch(branch)}
                  onViewPlan={() => router.push(`/dashboard/floor-plan?branchId=${branch.id}`)}
                />
              ))}
              
              {/* Expand Network Card */}
              <div 
                className="bg-slate-50/30 rounded-xl border-2 border-dashed border-slate-200 h-full min-h-[300px] flex flex-col items-center justify-center cursor-pointer group hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                onClick={() => setIsAddModalOpen(true)}
              >
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="text-slate-400 group-hover:text-orange-500 transition-colors" size={24} />
                </div>
                <h3 className="text-slate-500 font-bold group-hover:text-orange-600 transition-colors mb-1">Add Branch</h3>
                <p className="text-xs text-slate-400">Create a new branch location</p>
              </div>
            </div>
          )}

          {/* BOTTOM WIDGETS — gated on isLoading so they don't briefly claim
              "0 branches" / "All Clear" off the empty-array default while
              the real branch list is still in flight. */}
          {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
              <NetworkStatusWidget branches={branches} />
              <AlertWidget branches={branches} onViewBranch={(b) => setSelectedBranchForDetails(b)} />
            </div>
          )}

        </div>
      </div>

      <AddBranchModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      <BranchModal
        isOpen={!!editingBranch}
        branchToEdit={editingBranch}
        onClose={() => setEditingBranch(null)}
        onSuccess={() => refetch()}
      />

      <BranchDetailsSlideOver
        branch={selectedBranchForDetails} 
        isOpen={!!selectedBranchForDetails} 
        onClose={() => setSelectedBranchForDetails(null)} 
      />
    </div>
  );
}
