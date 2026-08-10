import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';
import React from 'react';
import { KpiCardSkeleton } from '@/components/ui/skeleton';

interface BranchKPIGridProps {
  kpis: any;
  tableData: any;
  isLoading?: boolean;
}

export function BranchKPIGrid({ kpis, tableData, isLoading }: BranchKPIGridProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </section>
    );
  }

  const revenue = kpis?.revenue || 0;
  const revenueDelta = kpis?.revenueDelta ?? 0;
  const orders = kpis?.orders || 0;
  const avgPrep = kpis?.avgPrepTime || 0;
  const occupiedTables = tableData?.statuses?.filter(
    (s: any) => s.status === 'occupied' || s.status === 'ready',
  ).length || 0;
  const totalTables = tableData?.statuses?.length || 12;
  const occupancyPercent = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;
  const staffCount = kpis?.staffOnShift ?? 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Revenue */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Branch Revenue Today</p>
          <h3 className="text-2xl font-black text-slate-900">{formatPKR(revenue)}</h3>
          <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${revenueDelta >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
            <span className="material-symbols-outlined text-sm">{revenueDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
            {revenueDelta > 0 ? '+' : ''}{revenueDelta}% vs yesterday
          </p>
        </div>
        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
        </div>
      </div>

      {/* Orders */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Orders Today</p>
          <h3 className="text-2xl font-black text-slate-900">{orders}</h3>
          <p className="text-slate-400 text-xs font-medium mt-2">
            {avgPrep > 0 ? `Avg. Prep Time: ${avgPrep} mins` : 'No data yet'}
          </p>
        </div>
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div className="w-full">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tables Occupied</p>
          <h3 className="text-2xl font-black text-slate-900">{occupiedTables}/{totalTables}</h3>
          <div className="w-24 h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${occupancyPercent}%` }} />
          </div>
        </div>
        <div className="w-12 h-12 flex-shrink-0 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chair</span>
        </div>
      </div>

      {/* Staff */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Staff on Shift</p>
          <h3 className="text-2xl font-black text-slate-900">{staffCount}</h3>
          <p className="text-slate-400 text-xs mt-2">{staffCount === 0 ? 'No active shift' : `${staffCount} staff active`}</p>
        </div>
        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
        </div>
      </div>
    </section>
  );
}
