'use client';

import React from 'react';

export function NetworkStatusWidget() {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 flex justify-between h-full">
      <div className="flex flex-col">
        <h4 className="text-[9px] uppercase text-orange-600 font-black tracking-wider mb-2">SYSTEM PERFORMANCE</h4>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Network Connectivity Status</h3>
        <p className="text-xs text-slate-600 max-w-[280px] leading-relaxed flex-1">
          All operational branches are currently synced with the central cloud ERP. Last global ping was successful at 14:02 PKT.
        </p>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-[10px] font-bold text-slate-700">3 Active Links</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span className="text-[10px] font-bold text-slate-700">1 Offline Cache</span>
          </div>
        </div>
      </div>
      
      <div className="w-32 h-20 bg-slate-800 rounded-lg flex-shrink-0 relative overflow-hidden self-center hidden sm:block">
        {/* Placeholder for network illustration/graph */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-700"></div>
        <div className="absolute bottom-0 w-full h-1/2 flex items-end gap-1 px-2 opacity-50">
          <div className="w-full bg-orange-500 rounded-t-sm" style={{ height: '40%' }}></div>
          <div className="w-full bg-orange-500 rounded-t-sm" style={{ height: '70%' }}></div>
          <div className="w-full bg-orange-500 rounded-t-sm" style={{ height: '100%' }}></div>
          <div className="w-full bg-orange-500 rounded-t-sm" style={{ height: '80%' }}></div>
        </div>
      </div>
    </div>
  );
}
