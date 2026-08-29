import { prisma } from '@dineiz/db';
import { fromZonedTime } from 'date-fns-tz';
import { emitShiftEvent, emitBreakEvent, emitDashboardStatsUpdated } from '../../lib/socket';
import { recomputeShiftAggregate } from '../../lib/shiftAggregate';
import { getBusinessDayRange } from '../../lib/date-utils';
import { applyOrderStatusSideEffects } from '../order/order.service';
import {
  OpenShiftSchema, CloseShiftSchema, CashEntrySchema,
} from './shift.schema';

export async function getCurrentShift(branchId: string, tenantId: string, userId: string) {
  return prisma.shift.findFirst({
    where: { branchId, tenantId, userId, status: 'OPEN' },
    include: { user: { select: { id: true, name: true } }, cashEntries: true },
    orderBy: { openedAt: 'desc' },
  });
}

/**
 * Resolves the timezone that "today", "yesterday" etc. should be measured in.
 * A branch-scoped query uses that branch's own timezone; an all-branches
 * query falls back to the tenant's first branch, then Asia/Karachi.
 */
async function resolveTimezone(tenantId: string, branchId?: string | null): Promise<string> {
  const branch = branchId
    ? await prisma.branch.findFirst({ where: { id: branchId }, select: { timezone: true } })
    : await prisma.branch.findFirst({ where: { tenantId }, select: { timezone: true }, orderBy: { createdAt: 'asc' } });
  return branch?.timezone || 'Asia/Karachi';
}

/** Turns YYYY-MM-DD calendar bounds into an absolute UTC instant range. */
function toInstantRange(tz: string, from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = fromZonedTime(`${from}T00:00:00`, tz);
  if (to) range.lte = fromZonedTime(`${to}T23:59:59.999`, tz);
  // A range whose end precedes its start can only ever return nothing. Swap
  // rather than silently showing an empty table — a manager who picked the
  // dates the wrong way round meant the range between them.
  if (range.gte && range.lte && range.gte > range.lte) {
    return { gte: range.lte, lte: range.gte };
  }
  return range;
}

export interface ShiftListQuery {
  branchId?: string;
  from?: string;
  to?: string;
  status?: 'OPEN' | 'CLOSED' | 'ABANDONED' | 'PENDING_SYNC';
  search?: string;
  cashierId?: string;
  page: number;
  limit: number;
}

/**
 * Shift history.
 *
 * Every filter (date range, status, cashier search) runs in Postgres rather
 * than being applied to a page of rows in the browser — that's what makes
 * "Today" fast on a branch with months of shifts, and what makes the
 * summary numbers describe the whole filtered range instead of whatever
 * happened to fit on page one.
 */
export async function listShifts(tenantId: string, query: ShiftListQuery) {
  // Role scoping is resolved by the handler (see resolveScope) — by the time a
  // query reaches here, an absent branchId genuinely means "all branches".
  const targetBranchId = query.branchId ?? undefined;
  const tz = await resolveTimezone(tenantId, targetBranchId);
  const openedAt = toInstantRange(tz, query.from, query.to);

  const where: any = {
    tenantId,
    ...(targetBranchId ? { branchId: targetBranchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.cashierId ? { userId: query.cashierId } : {}),
    ...(openedAt ? { openedAt } : {}),
    ...(query.search
      ? { user: { name: { contains: query.search, mode: 'insensitive' as const } } }
      : {}),
  };

  const include = {
    user: { select: { id: true, name: true, image: true, avatarColor: true } },
    branch: { select: { id: true, name: true } },
    _count: { select: { orders: true, breaks: true } },
  };

  const skip = (query.page - 1) * query.limit;

  const [data, total, agg, openCount, byBranchRaw] = await Promise.all([
    prisma.shift.findMany({ where, orderBy: { openedAt: 'desc' }, skip, take: query.limit, include }),
    prisma.shift.count({ where }),
    prisma.shift.aggregate({
      where,
      _sum: { totalSales: true, totalCash: true, totalCard: true, cashVariance: true, totalOrders: true },
    }),
    prisma.shift.count({ where: { ...where, status: 'OPEN' } }),
    // Per-branch rollup so the all-branches view can show which branch each
    // number came from without pulling every shift into the browser.
    targetBranchId
      ? Promise.resolve([] as any[])
      : prisma.shift.groupBy({
          by: ['branchId'],
          where,
          _sum: { totalSales: true, cashVariance: true },
          _count: { id: true },
        }),
  ]);

  // Average duration over closed shifts only — an open shift has no end yet,
  // and counting "now" as its close would drag the average around by the minute.
  const closed = await prisma.shift.findMany({
    where: { ...where, closedAt: { not: null } },
    select: { openedAt: true, closedAt: true },
  });
  const avgDurationMs = closed.length
    ? closed.reduce((s, r) => s + (r.closedAt!.getTime() - r.openedAt.getTime()), 0) / closed.length
    : 0;

  let byBranch: { branchId: string; branchName: string; shifts: number; totalSales: number; cashVariance: number }[] = [];
  if (byBranchRaw.length > 0) {
    const branches = await prisma.branch.findMany({
      where: { id: { in: byBranchRaw.map((b: any) => b.branchId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(branches.map((b) => [b.id, b.name]));
    byBranch = byBranchRaw
      .map((b: any) => ({
        branchId: b.branchId,
        branchName: nameById.get(b.branchId) ?? 'Unknown branch',
        shifts: b._count.id,
        totalSales: Number(b._sum.totalSales ?? 0),
        cashVariance: Number(b._sum.cashVariance ?? 0),
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  return {
    data,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) },
    summary: {
      totalShifts: total,
      openShifts: openCount,
      totalSales: Number(agg._sum.totalSales ?? 0),
      totalCash: Number(agg._sum.totalCash ?? 0),
      totalCard: Number(agg._sum.totalCard ?? 0),
      totalOrders: Number(agg._sum.totalOrders ?? 0),
      netVariance: Number(agg._sum.cashVariance ?? 0),
      avgDurationMs,
    },
    byBranch,
    timezone: tz,
    // Echo the resolved scope back so the UI can label itself honestly
    // ("All branches" vs a specific one) instead of guessing.
    scope: { branchId: targetBranchId ?? null },
  };
}

export async function getShift(tenantId: string, id: string) {
  const shift = await prisma.shift.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true, avatarColor: true } },
      // The detail page and the PDF both label the shift with its branch;
      // without this they could only show a cashier name, which is ambiguous
      // as soon as a tenant has more than one branch.
      branch: { select: { id: true, name: true, phone: true, timezone: true } },
      cashEntries: { orderBy: { createdAt: 'asc' } },
      denominations: { orderBy: { denomination: 'desc' } },
      breaks: { orderBy: { startedAt: 'asc' } },
      _count: { select: { orders: true, activities: true } },
    },
  });

  if (!shift) return null;

  const [waiterStats, managerOverrides] = await Promise.all([
    prisma.order.groupBy({
      by: ['assignedWaiterId', 'assignedWaiterName'],
      where: { shiftId: id, status: { notIn: ['CANCELLED'] }, assignedWaiterId: { not: null } },
      _count: { id: true },
      _sum: { netAmount: true },
    }),
    // Spec Part 10 — every manager overlay that ran on this shift + what it did.
    prisma.managerOverride.findMany({ where: { shiftId: id }, orderBy: { startedAt: 'asc' } }),
  ]);

  return { ...shift, waiterStats, managerOverrides };
}

export async function openShift(tenantId: string, userId: string, data: { branchId: string; openingFloat: number }) {
  const existing = await prisma.shift.findFirst({ where: { branchId: data.branchId, userId, tenantId, status: 'OPEN' } });
  if (existing) return { conflict: true, shiftId: existing.id };

  const shift = await prisma.shift.create({
    data: { tenantId, branchId: data.branchId, userId, openingFloat: data.openingFloat, status: 'OPEN' },
    include: { user: { select: { id: true, name: true } } },
  });
  // Write OPENED activity record
  await prisma.shiftActivity.create({
    data: { shiftId: shift.id, activityType: 'OPENED', performedById: userId, amount: data.openingFloat, notes: `Shift opened with PKR ${data.openingFloat.toLocaleString()} float` },
  });
  emitShiftEvent(data.branchId, 'opened', shift.id);
  emitDashboardStatsUpdated(tenantId, data.branchId);
  return { conflict: false, shift };
}

/**
 * The stored sales columns on a Shift (totalSales, totalCash, …).
 *
 * A shift only gets these written once it stops being OPEN. Both endings need
 * them — a normal close and the abandoned-shift sweeper — so the arithmetic
 * lives here rather than in whichever one was written first. Without it, an
 * abandoned shift reads as PKR 0 in Shift Management no matter how much it
 * actually took.
 */
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

export interface CloseShiftInput {
  /** Cash the cashier physically counted. `null` = never counted (force close). */
  closingCash: number | null;
  notes?: string;
  denominations?: { denomination: number; quantity: number }[];
  /** POS path: a manager authorises the override by entering their PIN. */
  overridePin?: string;
  overrideReason?: string;
  /**
   * Dashboard path: the caller is already authenticated as a manager, so no
   * PIN round-trip is needed — the route's requireRole is the authorisation.
   */
  force?: boolean;
  forcedById?: string;
  /**
   * Spec Part 6 — the terminal is closing with events still unsynced. The
   * shift goes to PENDING_SYNC instead of CLOSED; the terminal keeps shipping
   * in the background and calls sync-complete when the queue drains.
   */
  pendingSync?: boolean;
  pendingSyncCount?: number;
}

export async function closeShift(tenantId: string, id: string, data: CloseShiftInput) {
  const shift = await prisma.shift.findFirst({ where: { id, tenantId, status: 'OPEN' } });
  if (!shift) return null;

  let isForceClosed = false;
  let managerId: string | null = null;

  if (data.overridePin) {
    const manager = await prisma.user.findFirst({
      where: { tenantId, posPin: data.overridePin, role: { in: ['BRANCH_MANAGER', 'TENANT_ADMIN'] } }
    });
    if (!manager) return { error: 'Invalid manager PIN or insufficient permissions' };
    if (!data.overrideReason?.trim()) return { error: 'Override reason is required' };
    isForceClosed = true;
    managerId = manager.id;
  } else if (data.force) {
    // A force close exists precisely to get past the pending-order blocker.
    // Routing it through canCloseShift meant the dashboard's Force Close
    // silently did nothing whenever there were unsettled orders — which is the
    // only situation anyone reaches for it in the first place.
    if (!data.overrideReason?.trim()) return { error: 'A reason is required to force close a shift' };
    isForceClosed = true;
    managerId = data.forcedById ?? null;
  } else {
    const canClose = await canCloseShift(tenantId, shift.branchId, id, shift.userId);
    if (!canClose.canClose) return { error: 'Shift cannot be closed due to pending orders', blockers: canClose.blockers };
  }

  // Spec Part 12 — a force close cancels the shift's still-open orders rather
  // than orphaning them, each with a reason that names the manager. Done
  // before computeShiftTotals so the frozen totals reflect the cancellations.
  if (isForceClosed) {
    const stillOpen = await prisma.order.findMany({
      where: { shiftId: id, tenantId, status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } },
      select: { id: true, status: true, branchId: true },
    });
    if (stillOpen.length > 0) {
      const reason = `Shift force closed${data.overrideReason ? ` — ${data.overrideReason}` : ''}`;
      for (const o of stillOpen) {
        const cancelled = await prisma.order.update({
          where: { id: o.id },
          data: { status: 'CANCELLED', notes: reason },
        }).catch(() => null);
        if (cancelled) await applyOrderStatusSideEffects(tenantId, cancelled, o.status, {}).catch(() => {});
      }
    }
  }

  const { totalSales, totalDiscount, totalTax, totalOrders, totalCash, totalCard } = await computeShiftTotals(id);

  const cashEntryAgg = await prisma.shiftCashEntry.groupBy({ by: ['type'], where: { shiftId: id }, _sum: { amount: true } });
  const cashIn = cashEntryAgg.find((e) => e.type === 'CASH_IN')?._sum.amount ?? 0;
  const cashOut = cashEntryAgg.find((e) => e.type === 'CASH_OUT')?._sum.amount ?? 0;

  const expectedCash = shift.openingFloat + totalCash + cashIn - cashOut;

  // An uncounted drawer has no variance. Recording closingCash 0 for a force
  // close reported the entire float plus every cash sale as a shortage, which
  // then polluted the branch's net-variance figure — a manager tidying up an
  // abandoned terminal looked like a theft event.
  const counted = data.closingCash;
  const cashVariance = counted === null ? null : parseFloat((counted - expectedCash).toFixed(2));
  const denominations = data.denominations ?? [];
  const closedAt = new Date();

  // Read outside the transaction. Everything inside an interactive transaction
  // races Prisma's 5s timeout, and on a remote Postgres each round trip is
  // ~700ms — reading breaks in there was enough to blow the budget and abort
  // the whole close with P2028. (Same trap as the one documented in
  // createOrder.) A break cannot outlive its shift: left open, every later read
  // measured its duration against "now", so a shift closed on Monday reported a
  // break that grew by a day every day.
  const openBreaks = await prisma.shiftBreak.findMany({ where: { shiftId: id, endedAt: null } });
  const endedBreaks = openBreaks.map((b) => ({
    id: b.id,
    durationMinutes: Math.max(0, Math.round((closedAt.getTime() - b.startedAt.getTime()) / 60_000)),
  }));

  const closeActivity = isForceClosed
    ? {
        shiftId: id,
        activityType: 'FORCE_CLOSED_BY_MANAGER' as const,
        performedById: managerId,
        notes: `Force closed by manager — ${data.overrideReason}${
          counted === null ? ' (drawer not counted)' : ` · PKR ${Math.round(counted).toLocaleString('en-US')} counted`
        }`,
        amount: counted,
      }
    : {
        shiftId: id,
        activityType: 'CLOSED' as const,
        performedById: shift.userId,
        notes: `Shift closed — PKR ${Math.round(counted ?? 0).toLocaleString('en-US')} counted`,
        amount: counted,
      };

  await prisma.$transaction(
    [
      ...(denominations.length > 0
        ? [prisma.shiftDenomination.createMany({
            data: denominations.map((d) => ({ shiftId: id, denomination: d.denomination, quantity: d.quantity, total: d.denomination * d.quantity })),
          })]
        : []),
      ...endedBreaks.map((b) =>
        prisma.shiftBreak.update({ where: { id: b.id }, data: { endedAt: closedAt, durationMinutes: b.durationMinutes } }),
      ),
      prisma.shift.update({
        where: { id },
        data: {
          // Spec Part 6 — PENDING_SYNC if the terminal still has events to
          // ship. sync-complete (or the auto-finaliser) flips it to CLOSED.
          status: data.pendingSync ? 'PENDING_SYNC' : 'CLOSED',
          closedAt,
          closingCash: counted,
          totalSales, totalCash, totalCard, totalDiscount, totalTax, totalOrders, cashVariance,
          notes: data.notes,
          closedReason: isForceClosed ? data.overrideReason : null,
          pendingSyncAt: data.pendingSync ? closedAt : null,
          pendingSyncCount: data.pendingSync ? (data.pendingSyncCount ?? null) : null,
        },
      }),
      prisma.shiftActivity.createMany({
        data: [
          ...endedBreaks.map((b) => ({
            shiftId: id,
            activityType: 'BREAK_END' as const,
            notes: `Break auto-ended at shift close — ${b.durationMinutes} minute${b.durationMinutes !== 1 ? 's' : ''}`,
            metadata: { breakId: b.id, durationMinutes: b.durationMinutes, autoEnded: true },
          })),
          closeActivity,
        ],
      }),
    ],
    // A batch transaction ships every statement in one round trip, so the whole
    // close is a single network hop rather than one per write.
  );

  // Spec Part 7 — make the running aggregate exactly match source at close,
  // so the shift's final number and every dashboard read of it agree. (For a
  // PENDING_SYNC close this is a best-effort snapshot; sync-complete redoes it
  // once the queued orders/payments actually land.)
  await recomputeShiftAggregate(id).catch((e) => console.warn('[closeShift] aggregate recompute failed', e));

  // Re-read with the relations the callers expect. Outside the transaction so
  // the include's extra queries can't count against its budget.
  const closed = await prisma.shift.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } }, denominations: { orderBy: { denomination: 'desc' } }, cashEntries: true },
  });

  emitShiftEvent(shift.branchId, data.pendingSync ? 'pending_sync' : 'closed', id);
  emitDashboardStatsUpdated(tenantId, shift.branchId);
  return closed;
}

/**
 * Spec Part 6 — the terminal has finished shipping a PENDING_SYNC shift's
 * queued events. Recompute the totals from what's now in the database, flip
 * the status to CLOSED, and tell the dashboard. Idempotent: a shift that is
 * already CLOSED (auto-finalised, or a duplicate call) just returns ok.
 */
export async function completeShiftSync(tenantId: string, id: string) {
  const shift = await prisma.shift.findFirst({ where: { id, tenantId } });
  if (!shift) return { error: 'Shift not found' };
  if (shift.status === 'CLOSED') return { ok: true, alreadyClosed: true };
  if (shift.status !== 'PENDING_SYNC') return { error: `Shift is ${shift.status}, not PENDING_SYNC` };

  const { totalSales, totalDiscount, totalTax, totalOrders, totalCash, totalCard } = await computeShiftTotals(id);
  await recomputeShiftAggregate(id).catch(() => {});

  await prisma.shift.update({
    where: { id },
    data: {
      status: 'CLOSED',
      pendingSyncAt: null,
      pendingSyncCount: null,
      totalSales, totalCash, totalCard, totalDiscount, totalTax, totalOrders,
    },
  });
  await prisma.shiftActivity.create({
    data: { shiftId: id, activityType: 'CLOSED', notes: 'Background sync completed — shift finalised' },
  }).catch(() => {});

  emitShiftEvent(shift.branchId, 'closed', id);
  emitDashboardStatsUpdated(tenantId, shift.branchId);
  return { ok: true };
}

export async function canCloseShift(tenantId: string, branchId: string, shiftId: string, userId: string) {
  const blockers: any[] = [];
  
  const pendingOrders = await prisma.order.findMany({
    where: { shiftId, tenantId, status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } },
    select: { id: true, orderNumber: true, totalAmount: true, status: true, table: { select: { label: true } } }
  });

  if (pendingOrders.length > 0) {
    blockers.push({
      type: 'PENDING_ORDERS',
      message: `You have ${pendingOrders.length} orders that have not been collected. Resolve these before closing your shift.`,
      count: pendingOrders.length,
      orders: pendingOrders,
    });
  }

  const activeShifts = await prisma.shift.findMany({
    where: { tenantId, branchId, status: 'OPEN' },
    select: { id: true, userId: true }
  });

  if (activeShifts.length === 1 && activeShifts[0].id === shiftId) {
    // Scoped to TODAY's business day. This query had no date or shift bound at
    // all — its own message says "orders from today" but it counted every
    // unsettled order the branch had ever accumulated, so any historical
    // orphan blocked every close forever, with no way to clear it from here.
    // Genuinely-old unresolved orders are the orphan flow's job
    // (GET /api/pos/orphans + the shift-open resolution modal), not a reason
    // to trap the cashier who's trying to go home.
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
    const { from, to } = getBusinessDayRange(branch?.timezone || 'Asia/Karachi');

    const branchPending = await prisma.order.count({
      where: {
        branchId, tenantId,
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
        createdAt: { gte: from, lte: to },
      },
    });

    if (branchPending > 0) {
      blockers.push({
        type: 'SOLE_CASHIER_ACTIVE',
        message: `You are the only cashier on shift at this branch. There are ${branchPending} orders from today that have not been settled. Closing your shift would leave these orders unresolved.`,
        count: branchPending,
      });
    }
  } else if (activeShifts.length > 1) {
    const assignedPending = await prisma.order.findMany({
      where: { 
        branchId, tenantId, 
        assignedWaiterId: userId,
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
        shiftId: { not: shiftId }
      },
      select: { id: true, orderNumber: true, totalAmount: true, status: true, table: { select: { label: true } } }
    });

    if (assignedPending.length > 0) {
      blockers.push({
        type: 'PENDING_ORDERS',
        message: `You have ${assignedPending.length} orders assigned to you that have not been collected. Resolve these before closing your shift.`,
        count: assignedPending.length,
        orders: assignedPending,
      });
    }
  }

  return { canClose: blockers.length === 0, blockers };
}

export async function addCashEntry(tenantId: string, id: string, data: { type: 'CASH_IN' | 'CASH_OUT'; amount: number; reason?: string }) {
  const shift = await prisma.shift.findFirst({ where: { id, tenantId, status: 'OPEN' } });
  if (!shift) return null;
  const entry = await prisma.shiftCashEntry.create({ data: { shiftId: id, type: data.type, amount: data.amount, reason: data.reason } });
  // Mirror to ShiftActivity for timeline
  await prisma.shiftActivity.create({
    data: {
      shiftId: id,
      activityType: data.type === 'CASH_IN' ? 'CASH_IN' : 'CASH_OUT',
      amount: data.amount,
      notes: data.reason,
      metadata: { cashEntryId: entry.id },
    },
  });
  return entry;
}

export async function getShiftSummary(tenantId: string, id: string) {
  const shift = await prisma.shift.findFirst({ where: { id, tenantId }, select: { id: true, status: true, openingFloat: true, openedAt: true } });
  if (!shift) return null;

  // Sales figures count COMPLETED orders ONLY — money actually taken. They
  // used to include every non-CANCELLED order, so orders still PENDING /
  // IN_KITCHEN / READY inflated "net sales" against a drawer that only ever
  // holds real payments: the close screen showed e.g. 5,700 in sales with far
  // less expected in the drawer and looked broken. This also makes the figure
  // agree with ShiftAggregate (lib/shiftAggregate.ts), which has always
  // counted COMPLETED only. Unpaid work is reported separately below.
  const [orderAgg, cashAgg, cardAgg, digitalAgg, totalOrders, unpaidAgg, cashEntryAgg, breaks] = await Promise.all([
    prisma.order.aggregate({ where: { shiftId: id, status: 'COMPLETED' }, _sum: { netAmount: true, discountAmount: true, taxAmount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CARD', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: { not: 'CASH' }, status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.order.count({ where: { shiftId: id, status: 'COMPLETED' } }),
    prisma.order.aggregate({
      where: { shiftId: id, status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } },
      _sum: { netAmount: true }, _count: { _all: true },
    }),
    prisma.shiftCashEntry.groupBy({ by: ['type'], where: { shiftId: id }, _sum: { amount: true } }),
    prisma.shiftBreak.findMany({ where: { shiftId: id }, select: { startedAt: true, endedAt: true, durationMinutes: true } }),
  ]);

  const totalCash = cashAgg._sum.amount ?? 0;
  const cashIn = cashEntryAgg.find((e) => e.type === 'CASH_IN')?._sum.amount ?? 0;
  const cashOut = cashEntryAgg.find((e) => e.type === 'CASH_OUT')?._sum.amount ?? 0;

  return {
    shiftId: id,
    status: shift.status,
    openedAt: shift.openedAt,
    openingFloat: shift.openingFloat,
    totalSales: orderAgg._sum.netAmount ?? 0,
    totalCash,
    totalCard: cardAgg._sum.amount ?? 0,
    totalDigital: digitalAgg._sum.amount ?? 0,
    totalDiscount: orderAgg._sum.discountAmount ?? 0,
    totalTax: orderAgg._sum.taxAmount ?? 0,
    totalOrders,
    // Still-open orders on this shift — shown as their own line on the close
    // screen so the gap between sales and the drawer is explicit, not implied.
    unpaidOrders: unpaidAgg._count._all ?? 0,
    unpaidValue: unpaidAgg._sum.netAmount ?? 0,
    cashIn,
    cashOut,
    // The close-shift screen must show the SAME expected figure the server
    // reconciles against, or the cashier sees one variance and the manager
    // sees another. Mid-shift safe drops and paid-outs are part of it —
    // the POS used to compute float + cash sales only and drift on any
    // shift where money left the drawer.
    expectedCash: shift.openingFloat + totalCash + cashIn - cashOut,
    breakCount: breaks.filter((b) => b.endedAt !== null).length,
    totalBreakMinutes: breaks.reduce((s, b) => s + (b.durationMinutes ?? 0), 0),
    onBreak: breaks.some((b) => b.endedAt === null),
  };
}

export async function getShiftOrders(tenantId: string, shiftId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { shiftId, tenantId, status: { notIn: ['CANCELLED'] } },
      include: {
        payments: { select: { method: true, amount: true, status: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { shiftId, tenantId, status: { notIn: ['CANCELLED'] } } }),
  ]);
  return { orders, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getShiftActivity(tenantId: string, shiftId: string, page = 1, limit = 20) {
  // Verify shift belongs to this tenant
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true } });
  if (!shift) return null;

  // Pull stored activities (written by openShift, closeShift, addCashEntry, startBreak, endBreak)
  const [stored, total] = await Promise.all([
    prisma.shiftActivity.findMany({
      where: { shiftId },
      orderBy: { occurredAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shiftActivity.count({ where: { shiftId } }),
  ]);

  // ShiftActivity stores only performedById (no relation), so resolve the
  // names in one extra query rather than N — the timeline is meaningless if
  // every line just says "someone did this".
  const performerIds = [...new Set(stored.map((a) => a.performedById).filter(Boolean))] as string[];
  const performers = performerIds.length
    ? await prisma.user.findMany({ where: { id: { in: performerIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(performers.map((u) => [u.id, u.name]));

  // Map to the UI-facing shape
  const events = stored.map((a) => ({
    id: a.id,
    time: a.occurredAt,
    type: a.activityType as string,
    description: a.notes ?? a.activityType,
    amount: a.amount ?? undefined,
    performedBy: a.performedById ? nameById.get(a.performedById) ?? null : null,
    metadata: a.metadata,
  }));

  return { events, total, page, limit, hasMore: (page - 1) * limit + stored.length < total };
}

export async function getActiveShiftStats(tenantId: string, branchId?: string | null) {
  const where = { tenantId, ...(branchId ? { branchId } : {}), status: 'OPEN' as const };
  const activeShifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, image: true, avatarColor: true } },
      // Needed for the Branch column the live board shows when a tenant admin
      // is viewing all branches at once.
      branch: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
      breaks: { orderBy: { startedAt: 'asc' } },
    },
    orderBy: { openedAt: 'desc' },
  });

  // Spec Part 7 — read the running per-shift totals as one indexed query
  // instead of 3 aggregate fan-outs per shift. A shift with no ShiftAggregate
  // row yet (brand new, or pre-migration) falls back to computing on the fly.
  const aggRows = await prisma.shiftAggregate.findMany({
    where: { shiftId: { in: activeShifts.map((s) => s.id) } },
  });
  const aggByShift = new Map(aggRows.map((a) => [a.shiftId, a]));

  // Enrich each shift with live payment aggregates + break stats
  const enriched = await Promise.all(activeShifts.map(async (shift) => {
    const agg = aggByShift.get(shift.id);
    let liveStats;
    if (agg) {
      liveStats = {
        cashOrders: 0, // per-method order counts aren't tracked on the aggregate
        cashTotal: Number(agg.cashRevenue),
        digitalOrders: 0,
        digitalTotal: Number(agg.cardRevenue) + Number(agg.otherRevenue),
        totalOrders: agg.orderCount,
        totalSales: Number(agg.netRevenue),
      };
    } else {
      const [cashAgg, cardAgg, orderAgg] = await Promise.all([
        prisma.payment.aggregate({ where: { order: { shiftId: shift.id }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true }, _count: { id: true } }),
        prisma.payment.aggregate({ where: { order: { shiftId: shift.id }, method: { not: 'CASH' }, status: 'COMPLETED' }, _sum: { amount: true }, _count: { id: true } }),
        prisma.order.aggregate({ where: { shiftId: shift.id, status: { notIn: ['CANCELLED'] } }, _sum: { netAmount: true }, _count: { id: true } }),
      ]);
      liveStats = {
        cashOrders: cashAgg._count.id,
        cashTotal: Number(cashAgg._sum.amount ?? 0),
        digitalOrders: cardAgg._count.id,
        digitalTotal: Number(cardAgg._sum.amount ?? 0),
        totalOrders: orderAgg._count.id,
        totalSales: Number(orderAgg._sum.netAmount ?? 0),
      };
    }

    const completedBreaks = shift.breaks.filter((b) => b.endedAt !== null);
    const activeBreak = shift.breaks.find((b) => b.endedAt === null) ?? null;
    const totalBreakMinutes = completedBreaks.reduce((s, b) => s + (b.durationMinutes ?? 0), 0);

    return {
      ...shift,
      liveStats,
      breakStats: {
        breakCount: completedBreaks.length,
        totalBreakMinutes,
        onBreak: activeBreak !== null,
        currentBreakStartedAt: activeBreak?.startedAt ?? null,
      },
    };
  }));

  const combinedEarnings = enriched.reduce((sum, s) => sum + s.liveStats.totalSales, 0);
  const uniqueCashiers = new Set(enriched.map(s => s.userId)).size;

  return { shifts: enriched, count: enriched.length, combinedEarnings, uniqueCashiers };
}

export async function startBreak(tenantId: string, shiftId: string, userId: string, reason?: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId, status: 'OPEN' },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!shift) return { error: 'Shift not found or not open' };

  // Prevent double-break: check no open break exists
  const existing = await prisma.shiftBreak.findFirst({ where: { shiftId, endedAt: null } });
  if (existing) return { error: 'A break is already active', breakId: existing.id, startedAt: existing.startedAt };

  const shiftBreak = await prisma.shiftBreak.create({
    data: { shiftId, reason },
  });

  await prisma.shiftActivity.create({
    data: {
      shiftId,
      activityType: 'BREAK_START',
      performedById: userId,
      notes: `Break started${reason ? ` — ${reason}` : ''}`,
      metadata: { breakId: shiftBreak.id },
    },
  });

  emitBreakEvent(shift.branchId, tenantId, 'started', { shiftId, cashierName: shift.user?.name, breakId: shiftBreak.id });

  // Long-break alert: fire after 30 minutes if break not ended
  const LONG_BREAK_MS = 30 * 60 * 1000;
  setTimeout(async () => {
    try {
      const check = await prisma.shiftBreak.findUnique({ where: { id: shiftBreak.id } });
      if (check && !check.endedAt) {
        const elapsed = Math.round((Date.now() - check.startedAt.getTime()) / 60_000);
        emitBreakEvent(shift.branchId, tenantId, 'long_break', {
          shiftId,
          cashierName: shift.user?.name,
          breakId: shiftBreak.id,
          durationMinutes: elapsed,
        });
      }
    } catch { /* ignore */ }
  }, LONG_BREAK_MS);

  return { breakId: shiftBreak.id, startedAt: shiftBreak.startedAt };
}

export async function endBreak(tenantId: string, shiftId: string, userId: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    select: { id: true, branchId: true, user: { select: { name: true } } },
  });
  if (!shift) return { error: 'Shift not found' };

  const openBreak = await prisma.shiftBreak.findFirst({ where: { shiftId, endedAt: null }, orderBy: { startedAt: 'desc' } });
  if (!openBreak) return { error: 'No active break found', alreadyEnded: true };

  const endedAt = new Date();
  const durationMinutes = Math.round((endedAt.getTime() - openBreak.startedAt.getTime()) / 60_000);

  const updated = await prisma.shiftBreak.update({
    where: { id: openBreak.id },
    data: { endedAt, durationMinutes },
  });

  await prisma.shiftActivity.create({
    data: {
      shiftId,
      activityType: 'BREAK_END',
      performedById: userId,
      notes: `Break ended — ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`,
      metadata: { breakId: openBreak.id, durationMinutes },
    },
  });

  emitBreakEvent(shift.branchId, tenantId, 'ended', { shiftId, breakId: openBreak.id, durationMinutes });

  return { breakId: openBreak.id, durationMinutes, endedAt };
}

export * from './shift-report.service';
