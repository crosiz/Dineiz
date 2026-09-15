'use client';

import { useEffect, useState } from 'react';
import { Unlock, X } from 'lucide-react';
import { useManagerOverlay } from '@/lib/manager-overlay';

// Spec Part 10 — the persistent amber bar shown while a manager overlay is
// active. Names the manager, whose terminal it is, the idle countdown, and a
// hard exit. Rendered by POSLayout above everything.
export function ManagerOverlayBar() {
  const overlay = useManagerOverlay((s) => s.overlay);
  const exit = useManagerOverlay((s) => s.exit);
  const remainingSec = useManagerOverlay((s) => s.remainingSec);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!overlay) return;
    const h = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [overlay]);

  if (!overlay) return null;

  const left = remainingSec();
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="shrink-0 h-10 bg-amber-500 text-white flex items-center justify-between px-4 gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.15)] z-[300]">
      <div className="flex items-center gap-2 min-w-0">
        <Unlock size={15} className="shrink-0" />
        <span className="text-[12px] font-bold truncate">MANAGER MODE — {overlay.managerName}</span>
        <span className="text-[11px] font-medium text-amber-50/90 truncate hidden sm:inline">
          · Working on {overlay.cashierName}'s terminal
        </span>
        {overlay.oneShot && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/20 shrink-0">ONE ACTION</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[12px] font-bold tabular-nums">{mm}:{ss}</span>
        <button
          onClick={() => exit('MANUAL')}
          className="h-7 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold flex items-center gap-1 transition-colors"
        >
          <X size={12} /> Exit Manager Mode
        </button>
      </div>
    </div>
  );
}
