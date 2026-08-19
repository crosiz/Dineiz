'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageLoader } from '@/components/ui/Spinner';
import { PieChart, Users, Sparkles, TrendingUp } from 'lucide-react';

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

  if (loading) return <PageLoader label="Loading metrics..." />;
  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 mb-1">Active Members</p>
          <h3 className="text-xl font-bold text-slate-900 font-mono">{metrics.activeMembers.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 mb-1">Points Outstanding</p>
          <h3 className="text-xl font-bold text-[#FF5722] font-mono">{metrics.totalPoints.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 mb-1">Avg Points / Member</p>
          <h3 className="text-xl font-bold text-slate-900 font-mono">{Math.round(metrics.avgPointsPerMember).toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-bold text-slate-900 mb-3">Top Loyalty Customers</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Tier</th>
                  <th className="py-2.5 px-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.topCustomers?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4">
                      {c.currentTier ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase" style={{ backgroundColor: `${c.currentTier.badgeColor}15`, color: c.currentTier.badgeColor }}>
                          {c.currentTier.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold font-mono text-[#FF5722]">{c.loyaltyPoints}</td>
                  </tr>
                ))}
                {metrics.topCustomers?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">No customer data yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 className="text-xs font-bold text-slate-900 mb-3">Tier Distribution</h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col items-center justify-center min-h-[220px]">
            <PieChart size={32} className="text-slate-300 mb-2" />
            <p className="text-slate-500 text-xs text-center max-w-xs">Tier distribution analytics will update as members earn points.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
