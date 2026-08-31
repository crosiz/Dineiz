'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { isViewMode } from '@/lib/view-mode';

// Spec Part 11 — a slim, non-blocking banner shown while the terminal is in
// View Mode (signed in, no shift). Never a modal. Every blocked action shows
// the same "Open a shift" prompt; this is the always-visible reminder.
export function ViewModeBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => setShow(isViewMode());
    check();
    const h = setInterval(check, 2000); // reflect an "open shift" done elsewhere
    window.addEventListener('storage', check);
    return () => { clearInterval(h); window.removeEventListener('storage', check); };
  }, []);

  if (!show) return null;

  return (
    <div className="shrink-0 h-8 bg-sky-600 text-white flex items-center justify-between px-4 gap-3 text-[12px] font-semibold z-[280]">
      <span className="flex items-center gap-1.5 min-w-0">
        <Info size={13} className="shrink-0" />
        <span className="truncate">View only — no shift open. You can’t take orders or payments.</span>
      </span>
      <button
        onClick={() => router.push('/pos/shift/open')}
        className="h-6 px-2.5 rounded-md bg-white/15 hover:bg-white/25 text-[11px] font-bold transition-colors shrink-0"
      >
        Open Shift
      </button>
    </div>
  );
}
