'use client';
import React from 'react';
import { Utensils } from 'lucide-react';

export function MenuItemForecastList({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <Utensils className="text-slate-300 mb-3" size={32} />
        <p>No item predictions available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((item, i) => (
        <div key={item.item.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 font-medium shrink-0 text-sm">
            {i + 1}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-slate-700 truncate">{item.item.name}</h4>
          </div>
          
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-slate-700">~{item.predictedQuantity}</p>
            <p className="text-[11px] text-slate-400">Orders</p>
          </div>
        </div>
      ))}
    </div>
  );
}
