'use client';
import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

function formatPKR(val: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val);
}

export function RevenueOverview({ data }: { data: any }) {
  if (!data) return null;
  const { kpis, dailyTrend } = data;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Revenue Overview</h2>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: formatPKR(kpis.totalRevenue) },
          { label: 'Orders', value: kpis.orderCount },
          { label: 'Avg Order Value', value: formatPKR(kpis.orderCount > 0 ? kpis.totalRevenue / kpis.orderCount : 0) },
          { label: 'Tax Collected', value: formatPKR(kpis.taxCollected) },
          { label: 'Net Revenue', value: formatPKR(kpis.netRevenue) },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 mb-1">{kpi.label}</span>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyTrend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              
              {/* Left Axis for Revenue */}
              <YAxis yAxisId="left" tickFormatter={(v) => `${v / 1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
              
              {/* Right Axis for Orders */}
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={10} />
              
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: string) => [name === 'revenue' ? formatPKR(value) : value, name === 'revenue' ? 'Net Revenue' : 'Orders']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              <Bar yAxisId="left" dataKey="revenue" fill="#ff5722" radius={[4, 4, 0, 0]} maxBarSize={40} name="revenue" />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="orders" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
