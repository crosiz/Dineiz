// ─── Table status: derived from orders, one authority (spec Part 3) ─────────
//
// A table's status is NOT written directly by order creation, payment, a
// poller, a socket handler and the floor-plan editor all racing each other.
// It is DERIVED — here — from the orders currently on the table plus the two
// things a manager can set explicitly (`statusOverride`, `isActive`). This one
// pure function is imported by:
//   • the POS view reducer     (apps/pos/lib/core/views.ts)
//   • the API recompute helper (apps/api/src/lib/tableStatus.ts)
//   • both reconciliation loops (client 60s, server 5min)
// so every screen and the database always agree on how a status was reached.

export type DerivedTableStatus =
  | 'FREE'
  | 'OCCUPIED'
  | 'BILL_REQUESTED'
  | 'DIRTY'
  | 'RESERVED'
  | 'INACTIVE'
  | 'MERGED';

export type TableStatusOverride = 'RESERVED' | 'INACTIVE' | 'MERGED' | null | undefined;

/** Order statuses that keep a table busy. */
export const TABLE_ACTIVE_ORDER_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY', 'SERVED'] as const;

export interface TableDerivationInput {
  /** Table.isActive — a deactivated table is INACTIVE regardless of anything else. */
  isActive: boolean;
  /** Explicit manager override; beats the derivation (with the RESERVED caveat below). */
  statusOverride: TableStatusOverride;
  /** Every order currently attached to the table that is still open. */
  activeOrders: Array<{ status: string; billRequestedAt?: string | number | Date | null }>;
  /** When the table's most recent order completed — anchors the DIRTY→FREE timer. */
  lastCompletedAt?: string | number | Date | null;
  /** Minutes a table stays DIRTY after the last order completes (TenantBranding). */
  cleaningMinutes: number;
  /** Injectable clock for tests / deterministic reconciliation. */
  now?: number;
}

export function deriveTableStatus(input: TableDerivationInput): DerivedTableStatus {
  const now = input.now ?? Date.now();

  // Hard overrides — beat the derivation outright.
  if (!input.isActive || input.statusOverride === 'INACTIVE') return 'INACTIVE';
  if (input.statusOverride === 'MERGED') return 'MERGED';

  const active = (input.activeOrders ?? []).filter((o) =>
    (TABLE_ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status),
  );

  if (active.length > 0) {
    // An order in progress always wins over a stale RESERVED hold.
    const billRequested = active.some((o) => o.billRequestedAt != null);
    return billRequested ? 'BILL_REQUESTED' : 'OCCUPIED';
  }

  // No active order. A reservation holds the table until it's cleared or an
  // order arrives (handled above).
  if (input.statusOverride === 'RESERVED') return 'RESERVED';

  const last = input.lastCompletedAt ? new Date(input.lastCompletedAt).getTime() : NaN;
  if (!Number.isNaN(last) && now - last < Math.max(0, input.cleaningMinutes) * 60_000) {
    return 'DIRTY';
  }
  return 'FREE';
}

const KNOWN: DerivedTableStatus[] = [
  'FREE', 'OCCUPIED', 'BILL_REQUESTED', 'DIRTY', 'RESERVED', 'INACTIVE', 'MERGED',
];

/** DB / legacy wire form is lowercase ("bill_requested"); the view + spec use uppercase. */
export function toDbTableStatus(s: DerivedTableStatus): string {
  return s.toLowerCase();
}

export function fromDbTableStatus(s: string | null | undefined): DerivedTableStatus {
  const up = String(s ?? 'free').toUpperCase().replace(/-/g, '_') as DerivedTableStatus;
  return KNOWN.includes(up) ? up : 'FREE';
}

/** The values `PUT /api/tables/:id/status` accepts — a manager override, never a derived state. */
export function parseTableOverride(
  raw: string | null | undefined,
): 'RESERVED' | 'INACTIVE' | 'MERGED' | 'CLEAR' {
  const up = String(raw ?? '').toUpperCase();
  if (up === 'RESERVED' || up === 'INACTIVE' || up === 'MERGED') return up;
  // "free" / "clean" / "available" / "" → clear any override and let the
  // derivation take back over.
  return 'CLEAR';
}
