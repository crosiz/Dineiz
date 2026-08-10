'use client';
import React from 'react';

function formatPKR(val: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val);
}

export function StaffPerformance({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.orders - a.orders);

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Staff Performance</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Staff Name</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Role</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Orders Handled</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Revenue Processed</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Avg Order Value</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Discounts Given</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium">{s.role}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-700">{s.orders}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-800">{formatPKR(s.revenue)}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatPKR(s.orders > 0 ? s.revenue / s.orders : 0)}</td>
                  <td className="px-6 py-4 text-right text-red-500 font-medium">{formatPKR(s.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
