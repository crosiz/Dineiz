'use client';
import { formatPKR, formatPercentage } from '@/lib/formatters';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface BranchComparisonTableProps {
  data: any[];
}

export function BranchComparisonTable({ data }: BranchComparisonTableProps) {
  const totalOrders = data.reduce((sum, b) => sum + b.orders, 0);
  const totalRevenue = data.reduce((sum, b) => {
    const num = parseInt(b.revenue.replace(/[^0-9]/g, ''));
    return sum + num;
  }, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 shrink-0">
        <h3 className="text-base font-bold text-slate-900">Branch Comparison</h3>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
            <tr>
              <th className="px-6 py-3">Branch</th>
              <th className="px-6 py-3 text-right">Orders</th>
              <th className="px-6 py-3 text-right">Revenue</th>
              <th className="px-6 py-3 text-right">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((branch) => (
              <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-900">{branch.name}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-semibold text-slate-700">{branch.orders.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-bold text-slate-900">{branch.revenue}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`inline-flex items-center gap-1 text-sm font-bold ${
                    branch.trend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {branch.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {branch.trend > 0 ? '+' : ''}{formatPercentage(branch.trend)}
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Total Row */}
            <tr className="bg-slate-50/80 border-t-2 border-slate-100">
              <td className="px-6 py-4">
                <span className="text-sm font-black text-slate-900">All Branches</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-black text-slate-900">{totalOrders.toLocaleString()}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-black text-[#ff5722]">{formatPKR(totalRevenue)}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-bold text-slate-400">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
