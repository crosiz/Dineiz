// One way to say how long something has been waiting.
//
// Home's attention list printed raw minutes ("waiting 267m") while the ticket
// timer said "4h 27m" for the same order. Everything goes through this now.

export function formatElapsed(fromIso: string | number | Date | null | undefined, now = Date.now()): string {
  if (fromIso == null) return '';
  const from = fromIso instanceof Date ? fromIso.getTime() : new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return '';
  return formatMinutes(Math.max(0, Math.floor((now - from) / 60_000)));
}

export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function minutesSince(fromIso: string | number | Date | null | undefined, now = Date.now()): number {
  if (fromIso == null) return 0;
  const from = fromIso instanceof Date ? fromIso.getTime() : new Date(fromIso).getTime();
  return Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 60_000)) : 0;
}

/** "just now" / "12m ago", for a sentence ("ready 12m ago", "held just now"). */
export function formatAgo(fromIso: string | number | Date | null | undefined, now = Date.now()): string {
  const e = formatElapsed(fromIso, now);
  if (!e) return '';
  return e === 'Just now' ? 'just now' : `${e} ago`;
}
