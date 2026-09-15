'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { SkeletonStatCards, SkeletonChartCard } from '@/components/ui/skeleton';
import { PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

type Tier = { id: string; name: string; badgeColor: string };

export function MetricsTab() {
  const [metrics, setMetrics] = useState<any>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const [metricsRes, tiersRes] = await Promise.all([
        apiFetch<any>('/api/loyalty/dashboard'),
        apiFetch<Tier[]>('/api/loyalty/tiers').catch(() => []),
      ]);
      setMetrics(metricsRes);
      setTiers(tiersRes);
    } catch (e) {
      console.error(e);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading metrics</span>
      <SkeletonStatCards count={3} />
      <SkeletonChartCard height={260} />
    </div>
  );

  if (isError || !metrics) {
    return (
      <div className="p-10 text-center flex flex-col items-center">
        <p className="text-xs font-bold text-red-500 mb-2">Couldn't load loyalty metrics.</p>
        <button onClick={fetchMetrics} className="text-xs font-semibold text-brand-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const tierChartData = (metrics.membersByTier || [])
    .map((row: any) => {
      const tier = tierMap.get(row.currentTierId);
      return { name: tier?.name ?? 'Unknown Tier', color: tier?.badgeColor ?? '#94a3b8', value: row._count as number };
    })
    .filter((d: any) => d.value > 0);

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
          <h3 className="text-xl font-bold text-brand-primary font-mono">{metrics.totalPoints.toLocaleString()}</h3>
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
                    <td className="py-2.5 px-4 text-right font-bold font-mono text-brand-primary">{c.loyaltyPoints}</td>
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 min-h-[220px]">
            {tierChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[188px]">
                <PieChartIcon size={32} className="text-slate-300 mb-2" />
                <p className="text-slate-500 text-xs text-center max-w-xs">No members have reached a tier yet — this fills in as customers earn points.</p>
              </div>
            ) : (
              <>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tierChartData} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name">
                        {tierChartData.map((d: any, i: number) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [`${val} member${val === 1 ? '' : 's'}`, name]}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
                  {tierChartData.map((d: any) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-slate-600 font-medium">{d.name}</span>
                      <span className="text-[11px] font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
