'use client';

import React from 'react';
import type { Branch } from './hooks/useBranches';

/** Real branch-status summary — no simulated telemetry. There's no actual
 * connectivity/sync monitoring system behind this yet, so it only shows
 * numbers genuinely derived from the branch list (active vs. total,
 * currently open for business) rather than fabricated network stats. */
export function NetworkStatusWidget({ branches }: { branches: Branch[] }) {
  const total = branches.length;
  const active = branches.filter(b => b.isActive).length;
  const openNow = branches.filter(b => b.stats?.isCurrentlyOpen).length;

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 flex flex-col h-full">
      <h4 className="text-[9px] uppercase text-orange-600 font-black tracking-wider mb-2">NETWORK STATUS</h4>
      <h3 className="text-sm font-bold text-slate-900 mb-2">Branch Network</h3>
      <p className="text-xs text-slate-600 max-w-[320px] leading-relaxed flex-1">
        {total === 0
          ? 'No branches yet — add your first branch to see it here.'
          : `${active} of ${total} branch${total === 1 ? '' : 'es'} active, ${openNow} currently open for business.`}
      </p>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${active > 0 ? 'bg-green-500' : 'bg-slate-300'}`}></span>
          <span className="text-[10px] font-bold text-slate-700">{active} Active</span>
        </div>
        {active < total && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span className="text-[10px] font-bold text-slate-700">{total - active} Inactive</span>
          </div>
        )}
      </div>
    </div>
  );
}
