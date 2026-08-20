'use client';

import React from 'react';
import type { Branch } from './hooks/useBranches';

/** Real branch-status summary — no simulated telemetry. There's no actual
 * connectivity/sync monitoring system behind this yet, so it only shows
 * numbers genuinely derived from the branch list. Leads with "currently
 * open for business" specifically because that's the one fact the page
 * header doesn't already show — the header covers active/inactive counts,
 * so repeating them here would just be the same numbers twice. */
export function NetworkStatusWidget({ branches }: { branches: Branch[] }) {
  const total = branches.length;
  const active = branches.filter(b => b.isActive).length;
  const openNow = branches.filter(b => b.stats?.isCurrentlyOpen).length;

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 flex flex-col h-full">
      <h4 className="text-[9px] uppercase text-orange-600 font-black tracking-wider mb-2">NETWORK STATUS</h4>
      {total === 0 ? (
        <>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Branch Network</h3>
          <p className="text-xs text-slate-600 max-w-[320px] leading-relaxed flex-1">
            No branches yet — add your first branch to see it here.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Currently Open</h3>
          <p className="text-2xl font-black text-slate-900">
            {openNow} <span className="text-sm font-medium text-slate-500">of {active} active branch{active === 1 ? '' : 'es'}</span>
          </p>
          <p className="text-xs text-slate-500 mt-2 flex-1">Open right now, based on each branch's configured hours.</p>
        </>
      )}
    </div>
  );
}
