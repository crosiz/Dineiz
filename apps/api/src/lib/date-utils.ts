import { prisma } from '@dineiz/db';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * A restaurant's "business day" is anchored to when a shift opened, not
 * calendar midnight — a shift opened Monday 10pm and closed Tuesday 3am
 * still belongs to Monday (see CLAUDE.md, "Shift-Based Data Scoping").
 *
 * Bounds are computed in the branch's own timezone (matching listOrders/
 * listOrderHistory elsewhere in this file) rather than the server's local
 * time — the API commonly runs in UTC, so a naive server-local "today"
 * would be off by hours from what the restaurant actually experiences as
 * today, and could misfile a shift that opened in the evening.
 */
export function getBusinessDayRange(tz: string, date: Date = new Date()): { from: Date; to: Date } {
  const zonedNow = toZonedTime(date, tz);
  zonedNow.setHours(0, 0, 0, 0);
  const from = fromZonedTime(zonedNow, tz);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from, to };
}

async function resolveBranchTimezone(branchId?: string): Promise<string> {
  if (!branchId) return 'Asia/Karachi';
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  return branch?.timezone || 'Asia/Karachi';
}

/**
 * Builds the where-clause fragment for "today's" orders at a branch, using
 * shift-open date rather than order-created date. An order counts as
 * "today" if the shift it was placed under opened today, OR — for orders
 * with no shift at all (QR/online orders aren't tied to a POS shift) — if
 * the order itself was created today.
 *
 * Without this, an order left in PENDING/IN_KITCHEN/READY under a shift
 * that was never closed keeps showing up on the live tickets board
 * indefinitely, days or weeks later, mixed in with today's real orders.
 */
export async function getTodayOrdersWhere(
  tenantId: string,
  branchId?: string,
): Promise<Record<string, any>> {
  const tz = await resolveBranchTimezone(branchId);
  const { from, to } = getBusinessDayRange(tz);

  const todayShifts = await prisma.shift.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}), openedAt: { gte: from, lte: to } },
    select: { id: true },
  });
  const todayShiftIds = todayShifts.map((s) => s.id);

  return {
    OR: [
      ...(todayShiftIds.length > 0 ? [{ shiftId: { in: todayShiftIds } }] : []),
      { shiftId: null, createdAt: { gte: from, lte: to } },
    ],
  };
}
