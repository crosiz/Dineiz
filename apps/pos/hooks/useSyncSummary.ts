'use client';

import { useEffect, useState } from 'react';
import { getUnsyncedSummary, type UnsyncedSummary } from '@/lib/core/outbox';

// ── One poll of the outbox, shared ──────────────────────────────────────────
//
// `getUnsyncedSummary()` is four IndexedDB reads (one `toArray` over every
// non-terminal event plus three counts). SyncHealthDot polled it every 4s from
// the always-mounted top bar, and HomeDashboard polled it every 4s again with
// its own identical interval — so on Home the terminal ran eight IndexedDB
// scans every four seconds to render the same number twice, and the two could
// disagree for up to 4s while they were out of phase.
//
// One module-level interval, shared by every subscriber, that only runs while
// someone is listening AND the tab is actually visible: a backgrounded POS
// tablet has nothing to show this to.

let timer: ReturnType<typeof setInterval> | null = null;
let latest: UnsyncedSummary | null = null;
const listeners = new Set<(s: UnsyncedSummary) => void>();

const POLL_MS = 4000;

async function tick() {
  try {
    const s = await getUnsyncedSummary();
    latest = s;
    for (const fn of Array.from(listeners)) fn(s);
  } catch {
    /* transient IndexedDB failure — the next tick tries again */
  }
}

function start() {
  if (timer) return;
  tick();
  timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    tick();
  }, POLL_MS);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Re-read immediately — e.g. right after a manual "Sync now". */
export function refreshSyncSummary(): void {
  tick();
}

export function useSyncSummary(): UnsyncedSummary | null {
  const [summary, setSummary] = useState<UnsyncedSummary | null>(latest);

  useEffect(() => {
    listeners.add(setSummary);
    start();
    // Coming back to a foregrounded tab, show the truth straight away rather
    // than up to 4s of whatever was on screen when it was backgrounded.
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(setSummary);
      document.removeEventListener('visibilitychange', onVisible);
      if (listeners.size === 0) stop();
    };
  }, []);

  return summary;
}
