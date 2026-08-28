'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUnsyncedSummary, type UnsyncedSummary } from '@/lib/core/outbox';

// Always-visible read on whether this terminal's events are reaching the
// server. Green = nothing queued. Amber = N in flight, still moving. Red =
// something needs a human (poisoned / abandoned / stalled / circuit open).
// Tap → the Sync Status panel, which has the retry / diagnostics tools.
type Health = 'ok' | 'syncing' | 'stuck';

function classify(s: UnsyncedSummary | null): { health: Health; label: string; detail: string } {
  if (!s) return { health: 'ok', label: 'Sync', detail: 'Checking…' };
  if (s.poisoned > 0 || s.abandoned > 0) {
    const n = s.poisoned + s.abandoned;
    return { health: 'stuck', label: `${n} to review`, detail: `${n} change${n === 1 ? '' : 's'} the server rejected — needs a manager` };
  }
  if (s.stalled || s.circuitOpen) {
    return { health: 'stuck', label: 'Sync stuck', detail: s.circuitOpen ? 'Can’t reach the server — retrying' : `${s.count} change${s.count === 1 ? '' : 's'} not moving` };
  }
  if (s.count > 0) {
    return { health: 'syncing', label: `${s.count}`, detail: `${s.count} change${s.count === 1 ? '' : 's'} syncing` };
  }
  return { health: 'ok', label: 'Synced', detail: `All ${s.confirmedToday} change${s.confirmedToday === 1 ? '' : 's'} today are saved` };
}

const DOT = {
  ok: 'bg-emerald-500',
  syncing: 'bg-amber-500 pulse-amber',
  stuck: 'bg-rose-500 pulse-red',
} as const;

export function SyncHealthDot() {
  const router = useRouter();
  const [summary, setSummary] = useState<UnsyncedSummary | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => getUnsyncedSummary().then((s) => { if (alive) setSummary(s); }).catch(() => {});
    tick();
    const h = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(h); };
  }, []);

  const { health, label, detail } = classify(summary);
  // Nothing queued and nothing wrong — stay quiet, just the dot.
  const showLabel = health !== 'ok';

  return (
    <button
      onClick={() => router.push('/pos/settings?section=syncStatus')}
      title={detail}
      className={`flex items-center gap-1.5 h-7 px-2 rounded-full border transition-colors ${
        health === 'stuck'
          ? 'border-rose-200 bg-rose-50 hover:bg-rose-100'
          : health === 'syncing'
            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
            : 'border-transparent hover:bg-[#F1F5F9]'
      }`}
      aria-label={`Sync status: ${detail}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[health]}`} />
      {showLabel && (
        <span className={`text-[10px] font-bold uppercase tracking-wider ${health === 'stuck' ? 'text-rose-700' : 'text-amber-700'}`}>
          {label}
        </span>
      )}
    </button>
  );
}
