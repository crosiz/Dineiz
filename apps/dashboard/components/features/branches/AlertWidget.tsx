'use client';

import React from 'react';

export function AlertWidget() {
  return (
    <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col h-full">
      <h4 className="text-[9px] uppercase text-slate-400 font-black tracking-wider mb-2">ALERTS</h4>
      <h3 className="text-sm font-bold text-white mb-2">Maintenance Due</h3>
      <p className="text-xs text-slate-400 flex-1 leading-relaxed">
        North Nazimabad hardware sync scheduled for tonight 03:00 AM. Expect up to 15 minutes of local offline caching.
      </p>
      
      <button className="w-full mt-4 border border-slate-700 rounded-lg py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors">
        View Schedule
      </button>
    </div>
  );
}
