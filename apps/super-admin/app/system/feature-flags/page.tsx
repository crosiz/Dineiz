'use client';

import React, { useEffect, useState } from 'react';
import { ToggleLeft, Plus, Check } from 'lucide-react';

export default function GlobalFeatureFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/clients')
      .then(() => {
        // Global feature flags defaults
        setFlags([
          { key: 'kds', name: 'Kitchen Display System (KDS)', minimumPlan: 'STARTER', isEnabled: true },
          { key: 'loyalty', name: 'CRM & Loyalty Program', minimumPlan: 'PRO', isEnabled: true },
          { key: 'multi_branch', name: 'Multi-Branch Management', minimumPlan: 'STARTER', isEnabled: true },
          { key: 'analytics_pro', name: 'Advanced Analytics & AI Forecasting', minimumPlan: 'PRO', isEnabled: true },
          { key: 'aggregator_integration', name: 'Food Aggregators (Foodpanda / Careem)', minimumPlan: 'ENTERPRISE', isEnabled: true },
          { key: 'zapier', name: 'Zapier & Webhook Integrations', minimumPlan: 'PRO', isEnabled: true },
          { key: 'zkteco', name: 'ZKTeco Biometric Attendance', minimumPlan: 'PRO', isEnabled: true },
        ]);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Global Feature Flags</h1>
          <p className="text-sm text-slate-400">Manage global feature availability across subscription tiers</p>
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3.5 px-4">Feature Key</th>
              <th className="py-3.5 px-4">Feature Name</th>
              <th className="py-3.5 px-4">Minimum Plan Level</th>
              <th className="py-3.5 px-4 text-right">Global Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {flags.map((f) => (
              <tr key={f.key}>
                <td className="py-3.5 px-4 font-mono text-amber-400 font-bold">{f.key}</td>
                <td className="py-3.5 px-4 text-white font-semibold">{f.name}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-900 border border-slate-800 text-slate-300">
                    {f.minimumPlan}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    GLOBAL OPERATIONAL
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
