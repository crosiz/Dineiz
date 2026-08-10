'use client';

import React from 'react';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Analytics & Intelligence</h1>
        <p className="text-sm text-slate-400">Deep SaaS revenue analytics, conversion rates, and tenant usage metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase">ARPU (Average Revenue Per User)</span>
          <div className="text-2xl font-bold text-amber-400 mt-2">PKR 14,250</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase">Trial Conversion Rate</span>
          <div className="text-2xl font-bold text-emerald-400 mt-2">68.5%</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase">LTV (Customer Lifetime Value)</span>
          <div className="text-2xl font-bold text-white mt-2">PKR 342,000</div>
        </div>
      </div>
    </div>
  );
}
