'use client';

import React from 'react';
import { Trophy, Medal } from 'lucide-react';

interface TopSellingItemsTableProps {
  data: any[];
}

export function TopSellingItemsTable({ data }: TopSellingItemsTableProps) {
  const getRankDisplay = (rank: number) => {
    switch(rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-slate-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-sm font-bold text-slate-400 w-6 text-center">{rank}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h3 className="text-base font-bold text-slate-900">Top Selling Items</h3>
        <button className="text-xs font-semibold text-[#ff5722] hover:text-orange-700 transition-colors">
          View All Menu
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
            <tr>
              <th className="px-6 py-3 w-16">Rank</th>
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3 text-right">Qty</th>
              <th className="px-6 py-3 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center justify-center w-6">
                    {getRankDisplay(item.rank)}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className="text-sm font-bold text-slate-900">{item.name}</span>
                </td>
                <td className="px-6 py-3">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.category}</span>
                </td>
                <td className="px-6 py-3 text-right">
                  <span className="text-sm font-semibold text-slate-700">{item.qty}</span>
                </td>
                <td className="px-6 py-3 text-right">
                  <span className="text-sm font-bold text-[#ff5722]">{item.revenue}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
