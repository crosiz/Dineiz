'use client';

import React from 'react';

interface PaymentMethodsChartProps {
  data: any[];
}

export function PaymentMethodsChart({ data }: PaymentMethodsChartProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-base font-bold text-slate-900 mb-6">Payment Methods</h3>
      
      <div className="flex-1 flex flex-col justify-center space-y-6">
        {data.map((item) => (
          <div key={item.method}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{item.method}</span>
              <span className="text-sm font-bold text-slate-900">{item.percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#ff5722] rounded-full" 
                style={{ width: `${item.percentage}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
