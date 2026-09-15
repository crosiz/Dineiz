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

  // Everything synced is the normal state, and the top bar's rule is to show
  // the exception only — the same reason the Online case has never had an
  // indicator. A permanent green dot is decoration that trains people to
  // ignore the spot where a real problem would appear.
  if (health === 'ok') return null;

  // No pill, no border, no uppercase — the bar's permanent-info zone is plain
  // text (the clock is plain text). Just a coloured dot and a count that sits
  // quietly next to the clock; it only ever appears when there's something to
  // act on, and tapping it opens the Sync & Data page.
  const tone = health === 'stuck'
    ? { dot: 'bg-rose-500 pulse-red', text: 'text-rose-600' }
    : { dot: 'bg-amber-500', text: 'text-amber-600' };

  return (
    <button
      onClick={() => router.push('/pos/settings?section=sync')}
      title={detail}
      aria-label={`Sync status: ${detail}`}
      className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
      <span className={`text-[12px] font-semibold tabular-nums ${tone.text}`}>{label}</span>
    </button>
  );
}
