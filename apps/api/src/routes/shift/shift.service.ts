import { prisma } from '@swiftserve/db';
import { emitShiftEvent, emitBreakEvent, emitDashboardStatsUpdated } from '../../lib/socket';
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

export async function listShifts(tenantId: string, query: { branchId?: string; cursor?: string; limit: number }, userBranchId?: string | null) {
  const targetBranchId = query.branchId ?? userBranchId ?? undefined;
  const shifts = await prisma.shift.findMany({
    where: { tenantId, ...(targetBranchId ? { branchId: targetBranchId } : {}) },
    orderBy: { openedAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, name: true } }, _count: { select: { orders: true } } },
  });
  const hasMore = shifts.length > query.limit;
  const data = hasMore ? shifts.slice(0, query.limit) : shifts;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function getShift(tenantId: string, id: string) {
  const shift = await prisma.shift.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      cashEntries: { orderBy: { createdAt: 'asc' } },
      denominations: { orderBy: { denomination: 'desc' } },
      breaks: { orderBy: { startedAt: 'asc' } },
      _count: { select: { orders: true } },
    },
  });

  if (!shift) return null;

  const waiterStats = await prisma.order.groupBy({
    by: ['assignedWaiterId', 'assignedWaiterName'],
    where: { shiftId: id, status: { notIn: ['CANCELLED'] }, assignedWaiterId: { not: null } },
    _count: { id: true },
    _sum: { netAmount: true },
  });

  return { ...shift, waiterStats };
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

export async function closeShift(tenantId: string, id: string, data: { closingCash: number; notes?: string; denominations?: any[], overridePin?: string, overrideReason?: string }) {
  const shift = await prisma.shift.findFirst({ where: { id, tenantId, status: 'OPEN' } });
  if (!shift) return null;

  let isForceClosed = false;
  let managerId: string | null = null;

  if (data.overridePin) {
    const manager = await prisma.user.findFirst({
      where: { tenantId, posPin: data.overridePin, role: { in: ['BRANCH_MANAGER', 'TENANT_ADMIN'] } }
    });
    if (!manager) return { error: 'Invalid manager PIN or insufficient permissions' };
    if (!data.overrideReason) return { error: 'Override reason is required' };
    isForceClosed = true;
    managerId = manager.id;
  } else {
    const canClose = await canCloseShift(tenantId, shift.branchId, id, shift.userId);
    if (!canClose.canClose) return { error: 'Shift cannot be closed due to pending orders', blockers: canClose.blockers };
  }

  const [orderAgg, cashAgg, cardAgg] = await Promise.all([
    prisma.order.aggregate({ where: { shiftId: id, status: { notIn: ['CANCELLED'] } }, _sum: { netAmount: true, discountAmount: true, taxAmount: true }, _count: { id: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CARD', status: 'COMPLETED' }, _sum: { amount: true } }),
  ]);

  const totalSales = orderAgg._sum.netAmount ?? 0;
  const totalDiscount = orderAgg._sum.discountAmount ?? 0;
  const totalTax = orderAgg._sum.taxAmount ?? 0;
  const totalOrders = orderAgg._count.id;
  const totalCash = cashAgg._sum.amount ?? 0;
  const totalCard = cardAgg._sum.amount ?? 0;

  const cashEntryAgg = await prisma.shiftCashEntry.groupBy({ by: ['type'], where: { shiftId: id }, _sum: { amount: true } });
  const cashIn = cashEntryAgg.find((e) => e.type === 'CASH_IN')?._sum.amount ?? 0;
  const cashOut = cashEntryAgg.find((e) => e.type === 'CASH_OUT')?._sum.amount ?? 0;

  const expectedCash = shift.openingFloat + totalCash + cashIn - cashOut;
  const cashVariance = parseFloat((data.closingCash - expectedCash).toFixed(2));
  const denominations = data.denominations ?? [];

  const closed = await prisma.$transaction(async (tx) => {
    if (denominations.length > 0) {
      await tx.shiftDenomination.createMany({
        data: denominations.map((d) => ({ shiftId: id, denomination: d.denomination, quantity: d.quantity, total: d.denomination * d.quantity })),
      });
    }
    const updatedShift = await tx.shift.update({
      where: { id },
      data: { 
        status: 'CLOSED', 
        closedAt: new Date(), 
        closingCash: data.closingCash, 
        totalSales, totalCash, totalCard, totalDiscount, totalTax, totalOrders, cashVariance, 
        notes: data.notes,
        closedReason: isForceClosed ? data.overrideReason : null
      },
      include: { user: { select: { id: true, name: true } }, denominations: { orderBy: { denomination: 'desc' } }, cashEntries: true },
    });
    
    if (isForceClosed) {
      await tx.shiftActivity.create({
        data: { shiftId: id, activityType: 'FORCE_CLOSED_BY_MANAGER', performedById: managerId, notes: `Force closed by manager. Reason: ${data.overrideReason}`, amount: data.closingCash },
      });
    } else {
      await tx.shiftActivity.create({
        data: { shiftId: id, activityType: 'CLOSED', notes: `Shift closed — PKR ${data.closingCash.toLocaleString()} counted`, amount: data.closingCash },
      });
    }
    return updatedShift;
  });

  emitShiftEvent(shift.branchId, 'closed', id);
  emitDashboardStatsUpdated(tenantId, shift.branchId);
  return closed;
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
    const branchPending = await prisma.order.findMany({
      where: { branchId, tenantId, status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } }
    });
    
    if (branchPending.length > 0) {
      blockers.push({
        type: 'SOLE_CASHIER_ACTIVE',
        message: `You are the only cashier on shift at this branch. There are ${branchPending.length} orders from today that have not been settled. Closing your shift would leave these orders unresolved.`,
        count: branchPending.length,
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

  const [orderAgg, cashAgg, cardAgg, totalOrders] = await Promise.all([
    prisma.order.aggregate({ where: { shiftId: id, status: { notIn: ['CANCELLED'] } }, _sum: { netAmount: true, discountAmount: true, taxAmount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { order: { shiftId: id }, method: 'CARD', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.order.count({ where: { shiftId: id, status: { notIn: ['CANCELLED'] } } }),
  ]);

  return {
    shiftId: id,
    status: shift.status,
    openedAt: shift.openedAt,
    openingFloat: shift.openingFloat,
    totalSales: orderAgg._sum.netAmount ?? 0,
    totalCash: cashAgg._sum.amount ?? 0,
    totalCard: cardAgg._sum.amount ?? 0,
    totalDiscount: orderAgg._sum.discountAmount ?? 0,
    totalTax: orderAgg._sum.taxAmount ?? 0,
    totalOrders,
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

  // Map to the UI-facing shape
  const events = stored.map((a) => ({
    time: a.occurredAt,
    type: a.activityType as string,
    description: a.notes ?? a.activityType,
    amount: a.amount ?? undefined,
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
      _count: { select: { orders: true } },
      breaks: { orderBy: { startedAt: 'asc' } },
    },
    orderBy: { openedAt: 'desc' },
  });

  // Enrich each shift with live payment aggregates + break stats
  const enriched = await Promise.all(activeShifts.map(async (shift) => {
    const [cashAgg, cardAgg, orderAgg] = await Promise.all([
      prisma.payment.aggregate({ where: { order: { shiftId: shift.id }, method: 'CASH', status: 'COMPLETED' }, _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.aggregate({ where: { order: { shiftId: shift.id }, method: { not: 'CASH' }, status: 'COMPLETED' }, _sum: { amount: true }, _count: { id: true } }),
      prisma.order.aggregate({ where: { shiftId: shift.id, status: { notIn: ['CANCELLED'] } }, _sum: { netAmount: true }, _count: { id: true } }),
    ]);

    const completedBreaks = shift.breaks.filter((b) => b.endedAt !== null);
    const activeBreak = shift.breaks.find((b) => b.endedAt === null) ?? null;
    const totalBreakMinutes = completedBreaks.reduce((s, b) => s + (b.durationMinutes ?? 0), 0);

    return {
      ...shift,
      liveStats: {
        cashOrders: cashAgg._count.id,
        cashTotal: Number(cashAgg._sum.amount ?? 0),
        digitalOrders: cardAgg._count.id,
        digitalTotal: Number(cardAgg._sum.amount ?? 0),
        totalOrders: orderAgg._count.id,
        totalSales: Number(orderAgg._sum.netAmount ?? 0),
      },
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
