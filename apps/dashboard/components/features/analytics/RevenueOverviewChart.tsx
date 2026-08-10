'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Download } from 'lucide-react';

interface RevenueOverviewChartProps {
  data: any[];
}

export function RevenueOverviewChart({ data }: RevenueOverviewChartProps) {
  const [activeTab, setActiveTab] = useState('Revenue');

  // Format handled by formatAxisPKR directly

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-slate-500 font-bold mb-1">{label}</p>
          <p className="text-sm font-black text-slate-900">
            {activeTab === 'Revenue' 
              ? `${formatPKR(payload[0].value)}`
              : `${payload[0].payload.orders} Orders`
            }
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm col-span-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Revenue Overview</h2>
          <p className="text-xs text-slate-400 mt-1">Performance from Oct 2, 2026 â€“ Oct 9, 2026</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('Revenue')}
              className={`text-sm font-bold transition-all relative pb-2 ${activeTab === 'Revenue' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Revenue
              {activeTab === 'Revenue' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff5722] rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('Orders')}
              className={`text-sm font-bold transition-all relative pb-2 ${activeTab === 'Orders' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Orders
              {activeTab === 'Orders' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff5722] rounded-t-full"></div>}
            </button>
          </div>
          
          <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff5722" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#ff5722" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={activeTab === 'Revenue' ? formatAxisPKR : undefined}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <ReferenceLine x="SAT" stroke="#e2e8f0" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey={activeTab === 'Revenue' ? 'revenue' : 'orders'} 
              stroke="#ff5722" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#revenueGradient)" 
              activeDot={{ r: 6, fill: '#ff5722', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
