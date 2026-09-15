import { prisma } from '@dineiz/db';
import { deriveTableStatus, toDbTableStatus } from '@dineiz/schemas';
import { recomputeTableStatus } from '../lib/tableStatus';

// ─── Table-status drift sweep (spec Part 3) ───────────────────────────────
//
// recomputeTableStatus() keeps Table.status correct on every order event.
// This job is the backstop: every 5 minutes it re-derives the status of
// every table that could plausibly be wrong (has an override, is non-free,
// completed something in the last few hours, or has a live order) and
// corrects any drift. Drift means something wrote table status outside the
// derivation — logged loudly so it gets found. (A dedicated
// TABLE_STATUS_DRIFT AnomalyType lands with the anomalies module phase.)

const ACTIVE_STATUSES = ['PENDING', 'IN_KITCHEN', 'READY'] as const;

export async function reconcileTableStatuses(): Promise<void> {
  const staleSince = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h

  // Candidate tables: anything not plainly idle-and-free.
  const candidates = await prisma.table.findMany({
    where: {
      OR: [
        { status: { not: 'free' } },
        { statusOverride: { not: null } },
        { lastCompletedAt: { gte: staleSince } },
        { orders: { some: { status: { in: [...ACTIVE_STATUSES] } } } },
      ],
    },
    select: {
      id: true, tenantId: true, branchId: true, isActive: true,
      status: true, statusOverride: true, lastCompletedAt: true,
    },
  });
  if (candidates.length === 0) return;

  // One cleaningMinutes lookup per tenant.
  const tenantIds = [...new Set(candidates.map((t) => t.tenantId))];
  const brandings = await prisma.tenantBranding.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { tenantId: true, tableCleaningMinutes: true },
  });
  const cleaningByTenant = new Map(brandings.map((b) => [b.tenantId, b.tableCleaningMinutes ?? 5]));

  let drift = 0;
  for (const t of candidates) {
    const activeOrders = await prisma.order.findMany({
      where: { tableId: t.id, tenantId: t.tenantId, status: { in: [...ACTIVE_STATUSES] } },
      select: { status: true, billRequestedAt: true },
    });
    const expected = toDbTableStatus(
      deriveTableStatus({
        isActive: t.isActive,
        statusOverride: (t.statusOverride as any) ?? null,
        activeOrders,
        lastCompletedAt: t.lastCompletedAt,
        cleaningMinutes: cleaningByTenant.get(t.tenantId) ?? 5,
      }),
    );
    if (expected !== t.status) {
      drift++;
      console.warn(
        `[tableStatusReconcile] DRIFT table=${t.id} branch=${t.branchId} was="${t.status}" expected="${expected}" — correcting`,
      );
      await recomputeTableStatus(t.tenantId, t.id);
    }
  }

  if (drift > 0) console.warn(`[tableStatusReconcile] corrected ${drift} drifted table(s)`);
}
