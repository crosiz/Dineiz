import { prisma } from '@dineiz/db';
import { deriveTableStatus, toDbTableStatus, fromDbTableStatus } from '@dineiz/schemas';
import { emitTableStatusChanged } from './socket';

// ─── Table status: the server's single writer (spec Part 3) ────────────────
//
// Order creation, status changes and payments no longer each poke
// `prisma.table.update({ status })` with their own guess. They call
// recomputeTableStatus(), which derives the status from the orders actually
// on the table (+ the manager override) via the SAME pure function the POS
// view reducer uses (@dineiz/schemas' deriveTableStatus). A 5-minute job
// (jobs/tableStatusReconcile.ts) sweeps for drift.

// The server OrderStatus enum has no SERVED yet — READY is the last "active"
// state here; the shared helper also lists SERVED for the client's benefit.
const ACTIVE_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY'] as const;

async function cleaningMinutesFor(tenantId: string): Promise<number> {
  const b = await prisma.tenantBranding.findUnique({
    where: { tenantId },
    select: { tableCleaningMinutes: true },
  });
  return b?.tableCleaningMinutes ?? 5;
}

/**
 * Derive a table's status from its live orders and persist it if it changed.
 * Returns the resulting DB status string, or null if the table is gone.
 * Fire-and-forget friendly — never throws.
 */
export async function recomputeTableStatus(
  tenantId: string,
  tableId: string,
  opts: { emit?: boolean; cleaningMinutes?: number } = {},
): Promise<string | null> {
  try {
    const table = await prisma.table.findFirst({
      where: { id: tableId, tenantId },
      select: {
        id: true, branchId: true, isActive: true, status: true,
        statusOverride: true, lastCompletedAt: true,
      },
    });
    if (!table) return null;

    const activeOrders = await prisma.order.findMany({
      where: { tableId, tenantId, status: { in: [...ACTIVE_STATUSES] } },
      select: { status: true, billRequestedAt: true },
    });

    const cleaningMinutes = opts.cleaningMinutes ?? (await cleaningMinutesFor(tenantId));

    const derived = deriveTableStatus({
      isActive: table.isActive,
      statusOverride: (table.statusOverride as any) ?? null,
      activeOrders: activeOrders.map((o) => ({ status: o.status, billRequestedAt: o.billRequestedAt })),
      lastCompletedAt: table.lastCompletedAt,
      cleaningMinutes,
    });
    const next = toDbTableStatus(derived);

    if (next !== table.status) {
      await prisma.table.update({ where: { id: tableId }, data: { status: next } });
      if (opts.emit !== false) {
        emitTableStatusChanged(table.branchId, { tableId, status: next }, tenantId);
      }
    }
    return next;
  } catch (e: any) {
    console.warn('[tableStatus] recompute failed for', tableId, e?.message);
    return null;
  }
}

/**
 * Stamp lastCompletedAt (anchors the DIRTY→FREE timer) then recompute. Call
 * this the moment an order on a table reaches COMPLETED / CANCELLED.
 */
export async function markTableOrderCompleted(tenantId: string, tableId: string): Promise<void> {
  await prisma.table.update({
    where: { id: tableId },
    data: { lastCompletedAt: new Date() },
  }).catch(() => {});
  await recomputeTableStatus(tenantId, tableId);
}

/**
 * Apply a manager's explicit override (RESERVED / INACTIVE / MERGED) or clear
 * it, then recompute so the visible status reflects the change immediately.
 */
export async function setTableOverride(
  tenantId: string,
  tableId: string,
  override: 'RESERVED' | 'INACTIVE' | 'MERGED' | null,
): Promise<string | null> {
  await prisma.table.update({
    where: { id: tableId },
    data: {
      statusOverride: override,
      overrideAt: override ? new Date() : null,
      // Deactivating a table is the one override that also flips isActive, so
      // the floor-plan editor and every other reader agree.
      ...(override === 'INACTIVE' ? { isActive: false } : {}),
      ...(override === null ? { isActive: true } : {}),
    },
  }).catch(() => {});
  return recomputeTableStatus(tenantId, tableId);
}

export { fromDbTableStatus };
