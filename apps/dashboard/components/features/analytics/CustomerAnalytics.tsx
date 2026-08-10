'use client';
import React from 'react';

export function CustomerAnalytics({ data }: { data: { unique: number } }) {
  if (!data) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Customer Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Unique Customers</h3>
          <p className="text-4xl font-black text-slate-800">{data.unique}</p>
          <p className="text-xs text-slate-400 mt-2">During selected period</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 flex items-center justify-center">
          <p className="text-slate-400 text-sm">More detailed customer analytics (retention & acquisition channels) require additional historical CRM integrations.</p>
        </div>
      </div>
    </section>
  );
}
