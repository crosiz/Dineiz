'use client';

import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { useSyncSummary } from '@/hooks/useSyncSummary';

// One sentence under the top bar while the terminal can't reach the server.
// It replaced a 10px "OFFLINE" pill: staff didn't know what it meant for them,
// and the answer is always the same, so say it: keep working, nothing is lost.
export function ConnectionBanner() {
  const summary = useSyncSummary();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const unreachable = !online || !!summary?.circuitOpen;
  if (!unreachable) return null;

  const waiting = summary?.count ?? 0;
  return (
    <div role="status" className="shrink-0 bg-warn/10 border-b border-warn/30 px-4 sm:px-6 py-2.5 flex items-center gap-3">
      <CloudOff className="w-[18px] h-[18px] text-warn shrink-0" strokeWidth={2.25} />
      <p className="min-w-0 flex-1 text-[14px] text-ink leading-snug">
        <span className="font-semibold">No connection.</span>{' '}
        Keep working. Everything is saved on this terminal and sends by itself when the connection is back.
      </p>
      {waiting > 0 && (
        <span className="shrink-0 text-[12px] font-semibold text-ink-2 tabular-nums">{waiting} waiting</span>
      )}
    </div>
  );
}
