'use client';

import React from 'react';
import { Package, AlertTriangle, XOctagon, CheckCircle } from 'lucide-react';

interface InventoryStatsBarProps {
  stats: {
    totalIngredients: number;
    lowStock: number;
    outOfStock: number;
    healthy: number;
  };
}

export function InventoryStatsBar({ stats }: InventoryStatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-y-6 gap-x-8 mb-6 bg-white py-4 px-6 rounded-xl border border-slate-100 shadow-sm">
      {/* Total Ingredients */}
      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
        <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
          <Package className="text-slate-600" size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Ingredients</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.totalIngredients}</h3>
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-100 hidden md:block"></div>

      {/* Low Stock */}
      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
        <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="text-amber-600" size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Low Stock</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.lowStock}</h3>
            <span className="text-[11px] font-medium text-amber-500">Approaching limit</span>
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>

      {/* Out of Stock */}
      <div className="flex items-center gap-3 flex-1 min-w-[150px]">
        <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <XOctagon className="text-red-500" size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Out of Stock</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.outOfStock}</h3>
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-100 hidden lg:block"></div>

      {/* Healthy */}
      <div className="flex items-center gap-3 flex-1 min-w-[150px]">
        <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle className="text-emerald-500" size={16} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Healthy</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.healthy}</h3>
            <span className="text-[11px] font-medium text-emerald-500">Optimal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
