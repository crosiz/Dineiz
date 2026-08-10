'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface CriticalAlertBannerProps {
  outOfStockCount: number;
}

export function CriticalAlertBanner({ outOfStockCount }: CriticalAlertBannerProps) {
  if (outOfStockCount === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="bg-orange-100 rounded-lg p-2 text-orange-600 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-orange-800">Critical Alert: Stock Depletion</h4>
          <p className="text-xs text-orange-600 mt-0.5">
            {outOfStockCount} essential ingredient{outOfStockCount > 1 ? 's are' : ' is'} currently out of stock. This may impact your active menu items.
          </p>
        </div>
      </div>
      <button className="border border-orange-300 rounded-lg px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors shrink-0 whitespace-nowrap">
        View Items
      </button>
    </div>
  );
}
