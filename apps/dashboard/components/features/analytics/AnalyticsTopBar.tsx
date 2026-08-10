'use client';

import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAnalyticsStore } from './store/analyticsStore';

export function AnalyticsTopBar() {
  const { period, setPeriod, autoRefreshInterval, setAutoRefreshInterval } = useAnalyticsStore();

  const periods: { id: any; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
        <div className="h-6 w-px bg-slate-200" />
        
        {/* Period Filters */}
        <div className="flex items-center gap-2">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                period === p.id 
                  ? 'bg-[#ff5722] text-white rounded-lg shadow-sm shadow-orange-200' 
                  : 'bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Auto Refresh */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <RefreshCw size={14} className={`text-slate-500 ${autoRefreshInterval > 0 ? 'animate-spin-slow' : ''}`} />
          <span className="text-xs font-medium text-slate-600">Auto-refresh:</span>
          <select 
            value={autoRefreshInterval} 
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="text-xs font-bold bg-transparent border-none outline-none text-slate-800 cursor-pointer"
          >
            <option value={0}>Off</option>
            <option value={5}>Every 5 min</option>
            <option value={15}>Every 15 min</option>
          </select>
        </div>

        {/* Download Report */}
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors no-print"
        >
          <Download size={16} />
          Download Report
        </button>
      </div>
    </div>
  );
}
