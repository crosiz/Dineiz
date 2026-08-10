'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export function MetricsTab() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await apiFetch<any>('/api/loyalty/dashboard');
        setMetrics(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) return <div>Loading metrics...</div>;
  if (!metrics) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-y-6 gap-x-8 mb-6 bg-white py-4 px-6 rounded-xl border border-slate-100 shadow-sm mt-6">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active Members</p>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-lg font-bold text-slate-900">{metrics.activeMembers.toLocaleString()}</h3>
            </div>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-100 hidden md:block"></div>
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Points Outstanding</p>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-lg font-bold text-[#ff5722]">{metrics.totalPoints.toLocaleString()}</h3>
            </div>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-100 hidden md:block"></div>
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Avg Points / Member</p>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-lg font-bold text-slate-900">{Math.round(metrics.avgPointsPerMember).toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Top Loyal Customers</h3>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="py-4 px-6">Customer</th>
                  <th className="py-4 px-6">Tier</th>
                  <th className="py-4 px-6 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.topCustomers?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-[13px] text-slate-900">{c.name}</td>
                    <td className="py-4 px-6 text-[13px]">
                      {c.currentTier ? (
                        <span className="px-1.5 py-0.5 font-bold rounded uppercase tracking-wide text-[9px]" style={{ backgroundColor: c.currentTier.badgeColor + '20', color: c.currentTier.badgeColor }}>
                          {c.currentTier.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-4 px-6 text-right text-[13px] font-bold text-[#ff5722]">{c.loyaltyPoints}</td>
                  </tr>
                ))}
                {metrics.topCustomers?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">No customers yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
           {/* Placeholder for members by tier donut chart */}
           <h3 className="text-lg font-bold text-gray-900 mb-4">Tier Distribution</h3>
           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[300px]">
              <span className="material-symbols-outlined text-gray-300 text-5xl mb-2">pie_chart</span>
              <p className="text-gray-500 text-sm text-center max-w-xs">Chart visualization for tier distribution will appear here.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
