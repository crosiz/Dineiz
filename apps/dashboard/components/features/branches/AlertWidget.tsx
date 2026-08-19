'use client';

import React from 'react';
import type { Branch } from './hooks/useBranches';

/** Real alerts only — flags branches that are actually marked inactive,
 * rather than a fabricated maintenance schedule. There's no hardware/sync
 * monitoring system behind this yet, so it doesn't pretend to have one. */
export function AlertWidget({ branches, onViewBranch }: { branches: Branch[]; onViewBranch: (branch: Branch) => void }) {
  const inactive = branches.filter(b => !b.isActive);

  return (
    <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col h-full">
      <h4 className="text-[9px] uppercase text-slate-400 font-black tracking-wider mb-2">ALERTS</h4>
      <h3 className="text-sm font-bold text-white mb-2">
        {inactive.length === 0 ? 'All Clear' : `${inactive.length} Branch${inactive.length === 1 ? '' : 'es'} Inactive`}
      </h3>

      {inactive.length === 0 ? (
        <p className="text-xs text-slate-400 flex-1 leading-relaxed">
          Every branch is currently marked active. Nothing needs attention right now.
        </p>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {inactive.slice(0, 3).map(b => (
            <button
              key={b.id}
              onClick={() => onViewBranch(b)}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs"
            >
              <span className="font-semibold text-white">{b.name}</span>
              <span className="block text-slate-400 mt-0.5">Marked inactive — tap to review</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
