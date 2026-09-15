import { prisma } from '@dineiz/db';

// ─── Running per-shift money totals (spec Part 7) ─────────────────────────
//
// incrementShiftAggregate() is called exactly once per order, the first time
// it reaches COMPLETED (from enqueueOrderEvents, under the
// Order.sideEffectsAppliedAt claim latch — a retried payment can never
// double-count). recomputeShiftAggregate() rebuilds the row from source and
// is the reconciliation / shift-close authority.

const CARD_METHODS = new Set(['CARD']);
const CASH_METHODS = new Set(['CASH']);

export interface AggTotals {
  orderCount: number;
  grossRevenue: number;
  discountTotal: number;
  taxCollected: number;
  netRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  otherRevenue: number;
  refundTotal: number;
  voidCount: number;
}

const ZERO: AggTotals = {
  orderCount: 0, grossRevenue: 0, discountTotal: 0, taxCollected: 0, netRevenue: 0,
  cashRevenue: 0, cardRevenue: 0, otherRevenue: 0, refundTotal: 0, voidCount: 0,
};

/** Split a payment set into cash / card / other, falling back to the order net. */
export function paymentBreakdown(
  payments: Array<{ method?: string | null; amount?: number | null }> | undefined,
  fallbackNet: number,
  fallbackMethod?: string | null,
): { cash: number; card: number; other: number } {
  const list = (payments && payments.length)
    ? payments
    : [{ method: fallbackMethod ?? 'CASH', amount: fallbackNet }];
  let cash = 0, card = 0, other = 0;
  for (const p of list) {
    const m = String(p.method ?? 'CASH').toUpperCase();
    const amt = Number(p.amount) || 0;
    if (CASH_METHODS.has(m)) cash += amt;
    else if (CARD_METHODS.has(m)) card += amt;
    else other += amt;
  }
  return { cash, card, other };
}

/** +1 order into the shift's running totals. Atomic upsert. */
export async function incrementShiftAggregate(
  order: any,
  payments?: Array<{ method?: string | null; amount?: number | null }>,
): Promise<void> {
  if (!order?.shiftId) return;
  const gross = Number(order.totalAmount) || 0;
  const discount = Number(order.discountAmount) || 0;
  const tax = Number(order.taxAmount) || 0;
  const net = Number(order.netAmount) || 0;
  const { cash, card, other } = paymentBreakdown(payments ?? order.payments, net, order.payments?.[0]?.method);

  try {
    await prisma.shiftAggregate.upsert({
      where: { shiftId: order.shiftId },
      create: {
        shiftId: order.shiftId, tenantId: order.tenantId, branchId: order.branchId,
        orderCount: 1, grossRevenue: gross, discountTotal: discount, taxCollected: tax,
        netRevenue: net, cashRevenue: cash, cardRevenue: card, otherRevenue: other,
      },
      update: {
        orderCount: { increment: 1 },
        grossRevenue: { increment: gross },
        discountTotal: { increment: discount },
        taxCollected: { increment: tax },
        netRevenue: { increment: net },
        cashRevenue: { increment: cash },
        cardRevenue: { increment: card },
        otherRevenue: { increment: other },
      },
    });
  } catch (e: any) {
    console.warn('[shiftAggregate] increment failed for shift', order.shiftId, e?.message);
  }
}

/** Back a completed order OUT of the totals (it was voided / cancelled after completing). */
export async function decrementShiftAggregate(
  order: any,
  payments?: Array<{ method?: string | null; amount?: number | null }>,
): Promise<void> {
  if (!order?.shiftId) return;
  const gross = Number(order.totalAmount) || 0;
  const discount = Number(order.discountAmount) || 0;
  const tax = Number(order.taxAmount) || 0;
  const net = Number(order.netAmount) || 0;
  const { cash, card, other } = paymentBreakdown(payments ?? order.payments, net, order.payments?.[0]?.method);
  try {
    await prisma.shiftAggregate.updateMany({
      where: { shiftId: order.shiftId },
      data: {
        orderCount: { decrement: 1 },
        grossRevenue: { decrement: gross },
        discountTotal: { decrement: discount },
        taxCollected: { decrement: tax },
        netRevenue: { decrement: net },
        cashRevenue: { decrement: cash },
        cardRevenue: { decrement: card },
        otherRevenue: { decrement: other },
        voidCount: { increment: 1 },
      },
    });
  } catch (e: any) {
    console.warn('[shiftAggregate] decrement failed for shift', order.shiftId, e?.message);
  }
}

/** Recompute a shift's totals from source orders + payments and overwrite the row. */
export async function recomputeShiftAggregate(shiftId: string): Promise<AggTotals> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, tenantId: true, branchId: true },
  });
  if (!shift) return ZERO;

  const [orderAgg, cashAgg, cardAgg, otherAgg, voids] = await Promise.all([
    prisma.order.aggregate({
      where: { shiftId, status: 'COMPLETED' },
      _sum: { totalAmount: true, discountAmount: true, taxAmount: true, netAmount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({ where: { order: { shiftId }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId }, method: 'CARD', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId }, method: { notIn: ['CASH', 'CARD'] }, status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.order.count({ where: { shiftId, status: { in: ['CANCELLED'] } } }),
  ]);

  const totals: AggTotals = {
    orderCount: orderAgg._count.id,
    grossRevenue: Number(orderAgg._sum.totalAmount ?? 0),
    discountTotal: Number(orderAgg._sum.discountAmount ?? 0),
    taxCollected: Number(orderAgg._sum.taxAmount ?? 0),
    netRevenue: Number(orderAgg._sum.netAmount ?? 0),
    cashRevenue: Number(cashAgg._sum.amount ?? 0),
    cardRevenue: Number(cardAgg._sum.amount ?? 0),
    otherRevenue: Number(otherAgg._sum.amount ?? 0),
    refundTotal: 0,
    voidCount: voids,
  };

  await prisma.shiftAggregate.upsert({
    where: { shiftId },
    create: { shiftId, tenantId: shift.tenantId, branchId: shift.branchId, ...totals },
    update: { ...totals },
  });
  return totals;
}

/**
 * Sum the running totals across every shift that is "current" at a branch —
 * open right now, or opened today. This is the number the admin dashboard's
 * "Today" card and the socket broadcast use: one indexed query, no
 * re-aggregation of orders.
 */
export async function getBranchTodayAggregate(
  tenantId: string,
  branchId?: string,
  fromInstant?: Date,
): Promise<AggTotals & { shiftCount: number }> {
  const from = fromInstant ?? startOfTodayUtcish();
  const shifts = await prisma.shift.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : {}),
      OR: [{ status: 'OPEN' }, { openedAt: { gte: from } }],
    },
    select: { id: true },
  });
  if (shifts.length === 0) return { ...ZERO, shiftCount: 0 };

  const agg = await prisma.shiftAggregate.aggregate({
    where: { shiftId: { in: shifts.map((s) => s.id) } },
    _sum: {
      orderCount: true, grossRevenue: true, discountTotal: true, taxCollected: true,
      netRevenue: true, cashRevenue: true, cardRevenue: true, otherRevenue: true,
      refundTotal: true, voidCount: true,
    },
  });
  const s = agg._sum;
  return {
    shiftCount: shifts.length,
    orderCount: Number(s.orderCount ?? 0),
    grossRevenue: Number(s.grossRevenue ?? 0),
    discountTotal: Number(s.discountTotal ?? 0),
    taxCollected: Number(s.taxCollected ?? 0),
    netRevenue: Number(s.netRevenue ?? 0),
    cashRevenue: Number(s.cashRevenue ?? 0),
    cardRevenue: Number(s.cardRevenue ?? 0),
    otherRevenue: Number(s.otherRevenue ?? 0),
    refundTotal: Number(s.refundTotal ?? 0),
    voidCount: Number(s.voidCount ?? 0),
  };
}

function startOfTodayUtcish(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
