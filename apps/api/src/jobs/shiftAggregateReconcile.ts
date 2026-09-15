import { prisma } from '@dineiz/db';
import { recomputeShiftAggregate } from '../lib/shiftAggregate';

// ─── Shift-aggregate drift sweep (spec Part 7) ────────────────────────────
//
// incrementShiftAggregate() keeps ShiftAggregate correct on every payment,
// under the once-per-order latch. This job is the backstop: every 15 minutes
// it recomputes each current shift's totals from source orders + payments
// and corrects any drift. Drift ⇒ something wrote (or failed to write) the
// aggregate outside the increment path ⇒ logged loudly.

const EPS = 1; // PKR — floating-point noise below this isn't "drift"

export async function reconcileShiftAggregates(): Promise<void> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const shifts = await prisma.shift.findMany({
    where: { OR: [{ status: 'OPEN' }, { openedAt: { gte: from } }] },
    select: { id: true, tenantId: true, branchId: true },
  });
  if (shifts.length === 0) return;

  const before = await prisma.shiftAggregate.findMany({
    where: { shiftId: { in: shifts.map((s) => s.id) } },
  });
  const beforeById = new Map(before.map((a) => [a.shiftId, a]));

  let drift = 0;
  for (const s of shifts) {
    const prev = beforeById.get(s.id);
    const now = await recomputeShiftAggregate(s.id);
    if (!prev) continue; // first time this shift got a row — not "drift"
    const dNet = Math.abs(Number(prev.netRevenue) - now.netRevenue);
    const dCount = Math.abs(prev.orderCount - now.orderCount);
    if (dNet > EPS || dCount > 0) {
      drift++;
      console.error(
        `[shiftAggregateReconcile] DRIFT shift=${s.id} branch=${s.branchId} ` +
        `netRevenue ${prev.netRevenue} → ${now.netRevenue}, orderCount ${prev.orderCount} → ${now.orderCount} — corrected`,
      );
    }
  }
  if (drift > 0) console.error(`[shiftAggregateReconcile] corrected ${drift} drifted shift aggregate(s)`);
}
