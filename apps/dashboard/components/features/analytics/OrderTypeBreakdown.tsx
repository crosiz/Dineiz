'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OrderTypeBreakdownProps {
  data: any[];
}

export function OrderTypeBreakdown({ data }: OrderTypeBreakdownProps) {
  const totalOrders = 127; // hardcoded total per HTML spec "127 Total Orders"

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-base font-bold text-slate-900 mb-6">Order Type</h3>
      
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                stroke="none"
                dataKey="value"
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Centered Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-4">
          <span className="text-3xl font-black text-slate-900 leading-none mb-1">{totalOrders}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center leading-tight">Total<br/>Orders</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        {data.map(item => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }}></div>
            <span className="text-xs font-semibold text-slate-700">{item.name} <span className="text-slate-400 font-normal">({item.value}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
