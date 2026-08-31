'use client';

import React, { useMemo, useState } from 'react';
import { Plus, TrendingDown, Trash2 } from 'lucide-react';
import { useWastage } from '../hooks/useWastage';
import { formatPKR } from '@/lib/formatters';
import { SkeletonTableRows } from '@/components/ui/skeleton';
import { AddWastageModal } from './AddWastageModal';
import { WastageAnalytics } from './WastageAnalytics';
import { humanizeReason, REASON_COLORS } from './wastageConstants';

const PAGE_SIZE = 15;

export function WastageTab() {
  const { logs, isLoading, analytics, isAnalyticsLoading } = useWastage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const topIngredient = analytics?.topIngredients?.[0];
  const visibleLogs = useMemo(() => logs.slice(0, visibleCount), [logs, visibleCount]);

  return (
    <div className="space-y-6">
      {/* Top strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">This Month&apos;s Wastage</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {isAnalyticsLoading ? <span className="inline-block h-6 w-24 skeleton-shimmer rounded align-middle" /> : formatPKR(analytics?.totalCost ?? 0)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#ff5722] flex items-center justify-center shrink-0">
            <Trash2 size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Wasted Ingredient</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {isAnalyticsLoading ? (
                <span className="inline-block h-6 w-24 skeleton-shimmer rounded align-middle" />
              ) : topIngredient ? (
                <>
                  {topIngredient.name} <span className="text-sm font-medium text-slate-400">({formatPKR(topIngredient.cost)})</span>
                </>
              ) : (
                <span className="text-sm font-medium text-slate-400">No wastage yet</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#ff5722] hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors w-full justify-center"
          >
            <Plus size={16} />
            Log Wastage
          </button>
        </div>
      </div>

      {/* Analytics */}
      <WastageAnalytics analytics={analytics} isLoading={isAnalyticsLoading} />

      {/* History table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">Wastage History</h3>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Ingredient</th>
                <th className="px-6 py-3">Qty</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Reported By</th>
                <th className="px-6 py-3">Branch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <SkeletonTableRows
                  rows={6}
                  columns={[{ w: 140, avatar: true }, 80, 70, 90, 110, 90]}
                />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-500 text-sm">No wastage logged yet.</td>
                </tr>
              ) : (
                visibleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-900">{log.ingredientName}</td>
                    <td className="px-6 py-3 text-sm text-red-600 font-medium whitespace-nowrap">-{log.quantityLost} {log.unit}</td>
                    <td className="px-6 py-3">
                      <span
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{ backgroundColor: `${REASON_COLORS[log.reason] ?? '#64748b'}1a`, color: REASON_COLORS[log.reason] ?? '#475569' }}
                      >
                        {humanizeReason(log.reason)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">{formatPKR(log.costImpact)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{log.reportedBy}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{log.branchName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {logs.length > visibleCount && (
          <div className="px-6 py-3 border-t border-slate-100 flex justify-center">
            <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="text-sm font-medium text-[#ff5722] hover:underline">
              Show more ({logs.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>

      <AddWastageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
