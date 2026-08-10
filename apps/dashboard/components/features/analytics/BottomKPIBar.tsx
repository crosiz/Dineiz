'use client';

import React from 'react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface BottomKPIBarProps {
  data: {
    newCustomers: { value: number; trend: number };
    returningRate: { value: number; target: number };
    avgBasketSize: { value: string; trend: number };
  };
}

export function BottomKPIBar({ data }: BottomKPIBarProps) {
  const sparklineData = [{v: 10}, {v: 12}, {v: 11}, {v: 15}, {v: 20}, {v: 18}, {v: 25}];
  const barData = [{v: 200}, {v: 240}, {v: 300}];

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (data.returningRate.value / 100) * circumference;

  return (
    <div className="grid grid-cols-3 gap-6 mb-8">
      {/* New Customers */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex flex-col justify-between h-[140px]">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">New Customers</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-3xl font-black text-slate-900 leading-none">{data.newCustomers.value}</h3>
            <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">
              <TrendingUp size={12} />
              +{data.newCustomers.trend}%
            </span>
          </div>
        </div>
        <div className="h-10 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Returning Rate */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex items-center justify-between h-[140px]">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Returning Rate</p>
          <h3 className="text-3xl font-black text-slate-900 leading-none mb-1">{data.returningRate.value}%</h3>
          <p className="text-xs text-slate-500 font-semibold">Target: {data.returningRate.target}%</p>
        </div>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="32" cy="32" r="24" stroke="#f1f5f9" strokeWidth="6" fill="none" />
            <circle 
              cx="32" 
              cy="32" 
              r="24" 
              stroke="#ff5722" 
              strokeWidth="6" 
              fill="none" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Avg Basket Size */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex flex-col justify-between h-[140px]">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Avg Basket Size</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-3xl font-black text-slate-900 leading-none">{data.avgBasketSize.value}</h3>
          </div>
          <span className="text-xs font-bold text-green-600 flex items-center gap-0.5 mt-1">
            <TrendingUp size={12} />
            +{data.avgBasketSize.trend}% vs last period
          </span>
        </div>
        <div className="h-10 w-24 self-end -mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 2 ? '#ff5722' : '#fed7aa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
