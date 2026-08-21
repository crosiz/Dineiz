import { prisma } from '@dineiz/db';

/**
 * Single source of truth for everything a shift report contains.
 *
 * The PDF and the Excel export used to each assemble their own numbers from
 * their own queries, which is how they drifted apart from what the dashboard
 * showed. Both now render this one object, so a figure can only be wrong in
 * one place.
 */
export async function buildShiftReportData(tenantId: string, shiftId: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      user: true,
      branch: { include: { tenant: true } },
      cashEntries: { orderBy: { createdAt: 'asc' } },
      denominations: { orderBy: { denomination: 'desc' } },
      breaks: { orderBy: { startedAt: 'asc' } },
    },
  });

  if (!shift) return null;

  const isOpen = shift.status === 'OPEN';

  const [orders, activities, waiterStats] = await Promise.all([
    prisma.order.findMany({
      where: { shiftId: shift.id, status: { notIn: ['CANCELLED'] } },
      include: {
        payments: { where: { status: 'COMPLETED' } },
        table: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.shiftActivity.findMany({ where: { shiftId: shift.id }, orderBy: { occurredAt: 'asc' } }),
    prisma.order.groupBy({
      by: ['assignedWaiterId', 'assignedWaiterName'],
      where: { shiftId: shift.id, status: { notIn: ['CANCELLED'] }, assignedWaiterId: { not: null } },
      _count: { id: true },
      _sum: { netAmount: true },
    }),
  ]);

  const cancelledOrders = await prisma.order.count({ where: { shiftId: shift.id, status: 'CANCELLED' } });

  // ── Money ──────────────────────────────────────────────────────────────────
  const totalOrders = orders.length;
  const grossSales = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalDiscount = orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0);
  const totalTax = orders.reduce((s, o) => s + (o.taxAmount ?? 0), 0);
  const totalRevenue = orders.reduce((s, o) => s + o.netAmount, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Payment methods are enumerated from the data rather than hardcoded to the
  // four that existed when this report was first written — a tenant that
  // enables a new method should see it here without a code change.
  const byMethod = new Map<string, { method: string; orders: number; amount: number }>();
  for (const order of orders) {
    for (const p of order.payments) {
      const key = p.method ?? 'OTHER';
      const row = byMethod.get(key) ?? { method: key, orders: 0, amount: 0 };
      row.orders += 1;
      row.amount += p.amount;
      byMethod.set(key, row);
    }
  }
  const paymentBreakdown = [...byMethod.values()].sort((a, b) => b.amount - a.amount);
  const cashTotal = byMethod.get('CASH')?.amount ?? 0;

  // Not every order carries a completed Payment row — an order settled on a
  // tab, closed by a manager, or written off leaves net sales with nothing
  // behind it. Reported explicitly so the payment table's rows actually add
  // up to its total instead of quietly falling short of net sales.
  const settledTotal = paymentBreakdown.reduce((s, p) => s + p.amount, 0);
  const unsettledAmount = Math.max(0, totalRevenue - settledTotal);
  const unsettledOrders = orders.filter(
    (o) => o.payments.reduce((s, p) => s + p.amount, 0) + 0.01 < o.netAmount,
  ).length;

  // ── Time ───────────────────────────────────────────────────────────────────
  const shiftEnd = shift.closedAt ? shift.closedAt.getTime() : Date.now();
  const shiftDurationSeconds = Math.max(0, Math.floor((shiftEnd - shift.openedAt.getTime()) / 1000));
  const totalBreakSeconds = shift.breaks.reduce((s, b) => {
    const end = b.endedAt ? b.endedAt.getTime() : Date.now();
    return s + Math.max(0, Math.floor((end - b.startedAt.getTime()) / 1000));
  }, 0);
  const activeSeconds = Math.max(0, shiftDurationSeconds - totalBreakSeconds);

  // ── Cash reconciliation ────────────────────────────────────────────────────
  const cashIn = shift.cashEntries.filter((e) => e.type === 'CASH_IN').reduce((a, e) => a + e.amount, 0);
  const cashOut = shift.cashEntries.filter((e) => e.type === 'CASH_OUT').reduce((a, e) => a + e.amount, 0);
  const expectedCash = shift.openingFloat + cashTotal + cashIn - cashOut;
  const actualCash = isOpen ? null : shift.closingCash;
  // `cashVariance` is the column the close writes and the dashboard reads.
  // (This used to read a non-existent `shift.variance`, silently falling back
  // to a recomputed number that could disagree with the dashboard.)
  const variance = isOpen ? null : shift.cashVariance ?? (actualCash ?? 0) - expectedCash;

  const countedFromDenominations = shift.denominations.reduce((a, d) => a + d.denomination * d.quantity, 0);

  return {
    shift,
    tenant: shift.branch.tenant,
    branch: shift.branch,
    isOpen,
    orders,
    activities,
    waiterStats,
    cancelledOrders,
    totals: {
      totalOrders,
      grossSales,
      totalDiscount,
      totalTax,
      totalRevenue,
      avgOrderValue,
    },
    paymentBreakdown,
    unsettled: { amount: unsettledAmount, orders: unsettledOrders },
    time: { shiftDurationSeconds, totalBreakSeconds, activeSeconds },
    cash: { openingFloat: shift.openingFloat, cashTotal, cashIn, cashOut, expectedCash, actualCash, variance, countedFromDenominations },
  };
}

export type ShiftReportData = NonNullable<Awaited<ReturnType<typeof buildShiftReportData>>>;
