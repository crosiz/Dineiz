// Opening a shift with no connection.
//
// A shift's id used to come from the server (POST /api/shifts/open), and every
// order is stamped with it (event-log.ts reads pos_shift) and stored against
// it (Order.shiftId is a foreign key). So without a connection there was no
// way to start the day: the first cashier in during an outage was stuck on the
// open-shift screen of a POS that could otherwise take orders offline.
//
// Now the terminal names the shift itself (`shf_…`), stamps orders with that
// id as usual, and registers the shift under the same id once it can reach
// the server (outbox.ts: registerPendingShiftOpen). Orders for it wait until
// then, since the server would reject an order pointing at a shift it has
// never seen. In the normal case nothing is ever rewritten.
//
// The one exception: if the server already has a shift open for this cashier
// at this branch (opened on another terminal, say), there can't be two. The
// terminal then joins that shift and records an alias, local id → server id,
// which everything that sends or compares a shift id goes through
// (resolveShiftId).

import { nanoid } from 'nanoid';

const PENDING_OPEN_KEY = 'pos_pending_shift_open';
const ALIASES_KEY = 'pos_shift_aliases';

export interface PendingShiftOpen {
  shiftId: string;
  branchId: string;
  userId: string;
  openingFloat: number;
  openedAt: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: nothing sensible to fall back to.
  }
}

export function newOfflineShiftId(): string {
  return `shf_${nanoid(20)}`;
}

export function queueShiftOpen(p: PendingShiftOpen): void {
  write(PENDING_OPEN_KEY, p);
}

export function readPendingShiftOpen(): PendingShiftOpen | null {
  if (typeof window === 'undefined') return null;
  return read<PendingShiftOpen>(PENDING_OPEN_KEY);
}

export function clearPendingShiftOpen(): void {
  write(PENDING_OPEN_KEY, null);
}

/** True while this shift exists only on this terminal. */
export function isShiftPendingOpen(shiftId: string | null | undefined): boolean {
  if (!shiftId) return false;
  const p = readPendingShiftOpen();
  return !!p && resolveShiftId(p.shiftId) === resolveShiftId(shiftId);
}

/** The id the server knows this shift by. */
export function resolveShiftId<T extends string | null | undefined>(shiftId: T): T {
  if (!shiftId || typeof window === 'undefined') return shiftId;
  const aliases = read<Record<string, string>>(ALIASES_KEY);
  if (!aliases) return shiftId;
  // Followed to the end: a renamed shift can later be joined to another.
  let id: string = shiftId;
  for (let hops = 0; hops < 5 && aliases[id]; hops++) id = aliases[id];
  return id as T;
}

export function recordShiftAlias(localId: string, serverId: string): void {
  const aliases = read<Record<string, string>>(ALIASES_KEY) ?? {};
  aliases[localId] = serverId;
  write(ALIASES_KEY, aliases);
}
