'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Lightbulb } from 'lucide-react';
import { formatPKR, formatAxisPKR } from '@/lib/formatters';
import type { WastageAnalytics as WastageAnalyticsData } from '../hooks/useWastage';
import { CHART_COLORS, REASON_COLORS, humanizeReason } from './wastageConstants';

function ChartSkeleton() {
  return <div className="h-[240px] w-full rounded-lg bg-slate-100 animate-pulse" />;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function WastageAnalytics({ analytics, isLoading }: { analytics: WastageAnalyticsData | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  if (!analytics) return null;

  const byDay = analytics.byDay ?? [];
  const byReason = analytics.byReason ?? [];
  const topIngredients = analytics.topIngredients ?? [];

  return (
    <div className="space-y-5">
      {analytics.insight && (
        <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Lightbulb size={14} className="text-[#ff5722]" />
          </div>
          <p className="text-sm text-slate-700">{analytics.insight}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cost over time */}
        <ChartCard title="Wastage Cost by Day">
          {byDay.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatAxisPKR} />
                  <Tooltip formatter={(val: number) => formatPKR(val)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="cost" stroke="#ff5722" strokeWidth={2} dot={{ r: 3, fill: '#ff5722' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* By reason */}
        <ChartCard title="Cost by Reason">
          {byReason.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <>
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byReason} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="cost" nameKey="reason">
                      {byReason.map((entry, index) => (
                        <Cell key={entry.reason} fill={REASON_COLORS[entry.reason] ?? CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatPKR(val)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
                {byReason.map((d, idx) => (
                  <div key={d.reason} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: REASON_COLORS[d.reason] ?? CHART_COLORS[idx % CHART_COLORS.length] }} />
                    <span className="text-xs text-slate-600">{humanizeReason(d.reason)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Top ingredients */}
        <ChartCard title="Top Wasted Ingredients">
          {topIngredients.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIngredients} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={formatAxisPKR} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={90} />
                  <Tooltip formatter={(val: number) => formatPKR(val)} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                  <Bar dataKey="cost" fill="#ff5722" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
