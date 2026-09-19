import { prisma } from '@dineiz/db';

// A shift's money, computed from its orders, payments and cash entries.
//
// Closing a shift freezes these numbers onto the Shift row, including the
// cash variance (counted − expected). A POS terminal can close while some of
// its payments are still on their way (offline, or a slow sync), and those
// payments land after the freeze. Before refreezeShiftTotals existed, a late
// payment raised the running dashboard aggregate but never the frozen row:
// the shift kept the expected cash it was closed against, so a drawer counted
// short by exactly the late payment was recorded as balanced, permanently.
// Every path that writes money to a shift that is no longer OPEN now calls
// refreezeShiftTotals, which recomputes the totals and the variance from
// source and writes a timeline line whenever the variance moves.

export async function computeShiftTotals(shiftId: string) {
  const [orderAgg, cashAgg, cardAgg] = await Promise.all([
    prisma.order.aggregate({ where: { shiftId, status: { notIn: ['CANCELLED'] } }, _sum: { netAmount: true, discountAmount: true, taxAmount: true }, _count: { id: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId }, method: 'CARD', status: 'COMPLETED' }, _sum: { amount: true } }),
  ]);

  return {
    totalSales: orderAgg._sum.netAmount ?? 0,
    totalDiscount: orderAgg._sum.discountAmount ?? 0,
    totalTax: orderAgg._sum.taxAmount ?? 0,
    totalOrders: orderAgg._count.id,
    totalCash: cashAgg._sum.amount ?? 0,
    totalCard: cardAgg._sum.amount ?? 0,
  };
}

export async function computeExpectedCash(shiftId: string, openingFloat: number, totalCash: number) {
  const cashEntryAgg = await prisma.shiftCashEntry.groupBy({ by: ['type'], where: { shiftId }, _sum: { amount: true } });
  const cashIn = cashEntryAgg.find((e) => e.type === 'CASH_IN')?._sum.amount ?? 0;
  const cashOut = cashEntryAgg.find((e) => e.type === 'CASH_OUT')?._sum.amount ?? 0;
  return { cashIn, cashOut, expectedCash: openingFloat + totalCash + cashIn - cashOut };
}

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`;
const describeVariance = (v: number | null) =>
  v === null ? 'not counted' : v === 0 ? 'balanced' : v < 0 ? `short ${pkr(-v)}` : `over ${pkr(v)}`;

/**
 * Recompute a closed (or closing) shift's frozen totals and cash variance from
 * source. No-op for an OPEN shift, whose totals are computed live on read.
 * Returns the variance change, if any, so callers can alert on it.
 */
export async function refreezeShiftTotals(
  shiftId: string,
  reason: string,
): Promise<{ varianceBefore: number | null; varianceAfter: number | null } | null> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, status: true, tenantId: true, branchId: true, userId: true, openingFloat: true, closingCash: true, cashVariance: true },
  });
  if (!shift || shift.status === 'OPEN') return null;

  const totals = await computeShiftTotals(shiftId);
  const { expectedCash } = await computeExpectedCash(shiftId, shift.openingFloat, totals.totalCash);
  const varianceAfter = shift.closingCash === null ? null : parseFloat((shift.closingCash - expectedCash).toFixed(2));
  const varianceBefore = shift.cashVariance;

  await prisma.shift.update({ where: { id: shiftId }, data: { ...totals, cashVariance: varianceAfter } });

  if (varianceBefore !== varianceAfter) {
    await prisma.shiftActivity.create({
      data: {
        shiftId,
        activityType: 'CLOSED',
        amount: varianceAfter,
        notes:
          `Totals updated after close (${reason}). Expected cash is now ${pkr(expectedCash)}; ` +
          `the drawer was ${describeVariance(varianceBefore)}, now ${describeVariance(varianceAfter)}.`,
        metadata: { lateUpdate: true, reason, expectedCash, varianceBefore, varianceAfter },
      },
    }).catch(() => {});

    // The drawer was counted against a lower figure than it should have been.
    // Put it where managers look for exactly this, not only on the timeline.
    if (varianceAfter !== null && varianceAfter < 0 && varianceAfter < (varianceBefore ?? 0)) {
      await prisma.anomalyEvent.create({
        data: {
          tenantId: shift.tenantId,
          branchId: shift.branchId,
          type: 'CASH_VARIANCE',
          severity: varianceAfter <= -1000 ? 'HIGH' : 'MEDIUM',
          description:
            `A payment reached the server after shift #${shiftId.slice(-6)} was closed. The drawer was counted at ` +
            `${pkr(shift.closingCash ?? 0)} against ${pkr(expectedCash)} now expected: short by ${pkr(-varianceAfter)}.`,
          affectedEntityId: shiftId,
          affectedUserId: shift.userId,
        },
      }).catch(() => {});
    }
  }
  return { varianceBefore, varianceAfter };
}
