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
 * Builds the where-clause fragment that scopes the POS live-orders board
 * (spec Part 2 — Shift Ownership).
 *
 *   • CASHIER  — pass `opts.shiftId`. The board shows exactly that shift's
 *     orders and nothing else: no other terminal's carts, no previous shift.
 *
 *   • MANAGER / branch view — omit `opts.shiftId`. The board shows orders
 *     under a shift that is CURRENTLY OPEN at the branch, plus shiftless
 *     orders (QR / WhatsApp / aggregator) created today.
 *
 * A still-active order under a shift that has since CLOSED or been ABANDONED
 * is an "orphan" — it is deliberately NOT included here. Orphans are
 * surfaced and resolved through the shift-open orphan flow
 * (GET /api/pos/orphans), never silently mixed back into the live board.
 * The abandoned-shift sweeper (jobs/abandonedShifts.ts) flips forgotten
 * OPEN shifts to ABANDONED, so a genuinely-open long service (past midnight)
 * still shows while a forgotten one drops out on its own.
 */
export async function getTodayOrdersWhere(
  tenantId: string,
  branchId?: string,
  opts?: { shiftId?: string | null },
): Promise<Record<string, any>> {
  if (opts?.shiftId) {
    return { shiftId: opts.shiftId };
  }

  const tz = await resolveBranchTimezone(branchId);
  const { from, to } = getBusinessDayRange(tz);

  const openShifts = await prisma.shift.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      status: 'OPEN',
    },
    select: { id: true },
  });
  const openShiftIds = openShifts.map((s) => s.id);

  return {
    OR: [
      ...(openShiftIds.length > 0 ? [{ shiftId: { in: openShiftIds } }] : []),
      { shiftId: null, createdAt: { gte: from, lte: to } },
    ],
  };
}
