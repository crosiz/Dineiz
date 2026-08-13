import { prisma } from '@dineiz/db';
import { upstash } from '../../lib/redis';
import { generateOrderNumber, generateTokenNumber } from '../../lib/tokenGenerator';
import { emitDashboardStatsUpdated } from '../../lib/socket';
import { sendLowStockIfNeeded } from '../../lib/lowStock';
import { enqueueZapierEvent } from '../../lib/webhooks';
import { erpSyncQueue, analyticsQueue } from '../../lib/queue';
import { redeemLoyaltyForOrder, earnLoyaltyForOrder } from '../loyalty/loyalty.service';
import { deductInventoryForOrder } from '../inventory/inventory.service';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// ─── KDS routing helper ───────────────────────────────────────────────────────

async function routeItemsToKdsStations(
  tenantId: string,
  branchId: string,
  items: any[],
): Promise<any[]> {
  const stations = await prisma.kdsStation.findMany({
    where: { tenantId, branchId, isActive: true },
    include: { routes: { orderBy: { priority: 'desc' } } },
  });

  const catchAllStation = stations.find((s) => s.catchAll);
  const allRoutes = stations
    .flatMap((s) => s.routes.map((r) => ({ ...r, stationId: s.id })))
    .sort((a, b) => b.priority - a.priority);

  const itemIds = items.map((i: any) => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, categoryId: true },
  });
  const itemCategoryMap = new Map(dbItems.map((i) => [i.id, i.categoryId]));

  return items.map((item: any) => {
    let targetStationId: string | null = null;
    const categoryId = itemCategoryMap.get(item.itemId);

    const itemMatch = allRoutes.find((r) => r.itemId === item.itemId);
    if (itemMatch) {
      targetStationId = itemMatch.stationId;
    } else if (categoryId) {
      const catMatch = allRoutes.find((r) => r.categoryId === categoryId);
      if (catMatch) targetStationId = catMatch.stationId;
    }
    if (!targetStationId && catchAllStation) targetStationId = catchAllStation.id;

    return {
      ...item,
      kdsStationId: targetStationId,
      kdsStatus: targetStationId ? 'WAITING' : 'DONE',
    };
  });
}

// ─── Tax helpers ──────────────────────────────────────────────────────────────

function applyRounding(value: number, method: string): number {
  if (method === 'FLOOR') return Math.floor(value);
  if (method === 'CEIL') return Math.ceil(value);
  return Math.round(value); // default ROUND
}

/**
 * Resolves the applied tax rate and label from the payment methods array.
 * For split payments, calculates a weighted blended rate.
 */
function resolveAppliedTax(
  payments: any[],
  cashTaxEnabled: boolean,
  cardTaxEnabled: boolean,
  cashTaxRate: number,
  cardTaxRate: number,
  cashTaxLabel: string,
  cardTaxLabel: string,
  subtotal: number,
  roundingMethod: string,
  clientTaxAmount?: number,
): { taxAmount: number; appliedTaxRate: number; appliedTaxLabel: string } {
  if (!payments || payments.length === 0) {
    let rate = cashTaxEnabled ? cashTaxRate : 0;
    let label = cashTaxEnabled ? `${cashTaxLabel} ${cashTaxRate}%` : 'Tax Disabled';

    if (clientTaxAmount !== undefined) {
      const cardRateTax = applyRounding(subtotal * ((cardTaxEnabled ? cardTaxRate : 0) / 100), roundingMethod);
      if (Math.abs(clientTaxAmount - cardRateTax) <= 1) {
        rate = cardTaxEnabled ? cardTaxRate : 0;
        label = cardTaxEnabled ? `${cardTaxLabel} ${cardTaxRate}%` : 'Tax Disabled';
      }
    }
    
    const taxAmount = applyRounding(subtotal * (rate / 100), roundingMethod);
    return { taxAmount, appliedTaxRate: rate / 100, appliedTaxLabel: label };
  }

  const CARD_METHODS = new Set(['CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'ONLINE']);
  const totalPaid = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  if (payments.length === 1) {
    const method = String(payments[0].method).toUpperCase();
    const isCash = method === 'CASH';
    const enabled = isCash ? cashTaxEnabled : cardTaxEnabled;
    const rate = enabled ? (isCash ? cashTaxRate : cardTaxRate) : 0;
    const label = enabled ? (isCash ? cashTaxLabel : cardTaxLabel) : 'Tax Disabled';
    const taxAmount = applyRounding(subtotal * (rate / 100), roundingMethod);
    return { taxAmount, appliedTaxRate: rate / 100, appliedTaxLabel: enabled ? `${label} ${rate}%` : label };
  }

  // Split payment — proportional tax per payment method
  let totalTax = 0;
  for (const p of payments) {
    const method = String(p.method).toUpperCase();
    const isCash = method === 'CASH';
    const enabled = isCash ? cashTaxEnabled : cardTaxEnabled;
    const rate = enabled ? (isCash ? cashTaxRate : cardTaxRate) : 0;
    const portionSubtotal = totalPaid > 0 ? (Number(p.amount) / totalPaid) * subtotal : 0;
    totalTax += portionSubtotal * (rate / 100);
  }
  const taxAmount = applyRounding(totalTax, roundingMethod);
  const blendedRate = subtotal > 0 ? totalTax / subtotal : 0;
  return { taxAmount, appliedTaxRate: blendedRate, appliedTaxLabel: 'GST (Split)' };
}

// ─── Service functions ────────────────────────────────────────────────────────

async function checkPlanLimits(tenantId: string): Promise<void> {
  const tenantData = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { featureOverrides: true }
  });

  if (!tenantData || !tenantData.plan) return;

  let limit = -1;
  const planDef = await prisma.planDefinition.findUnique({ where: { id: tenantData.plan } });
  if (!planDef) return;

  const overrides = tenantData.featureOverrides || [];
  const orderLimitOverride = overrides.find(o => o.featureKey === 'dailyOrders');

  if (orderLimitOverride && !isNaN(Number(orderLimitOverride.value))) {
    limit = Number(orderLimitOverride.value);
  } else if (planDef.limits && (planDef.limits as any).dailyOrders !== undefined) {
    limit = (planDef.limits as any).dailyOrders;
  }

  if (limit === -1) return;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayOrdersCount = await prisma.order.count({
    where: { tenantId, createdAt: { gte: startOfDay } }
  });

  if (todayOrdersCount >= limit) {
    throw new Error('PLAN_LIMIT_EXCEEDED');
  }
}

export async function createOrder(
  tenantId: string,
  userId: string,
  body: any,
) {
  const { items, payments, orderDeals, branchId, cashierId, customerPhone, customerName, ...orderData } = body;

  // ── Independent lookups run concurrently instead of as a sequential waterfall ──
  const [, tenantBranding, orderNumber, tokenNumber, routedItems] = await Promise.all([
    checkPlanLimits(tenantId),
    prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        cashTaxEnabled: true, cashTaxRate: true, cashTaxLabel: true,
        cardTaxEnabled: true, cardTaxRate: true, cardTaxLabel: true,
        taxRoundingMethod: true,
      },
    }),
    generateOrderNumber(tenantId),
    generateTokenNumber(branchId, userId),
    routeItemsToKdsStations(tenantId, branchId, items),
  ]);

  const cashTaxEnabled = tenantBranding?.cashTaxEnabled ?? true;
  const cashTaxRate = tenantBranding?.cashTaxRate ?? 5;
  const cardTaxEnabled = tenantBranding?.cardTaxEnabled ?? true;
  const cardTaxRate = tenantBranding?.cardTaxRate ?? 17;
  const cashTaxLabel = tenantBranding?.cashTaxLabel ?? 'GST (Cash)';
  const cardTaxLabel = tenantBranding?.cardTaxLabel ?? 'GST (Card/Digital)';
  const roundingMethod = tenantBranding?.taxRoundingMethod ?? 'ROUND';

  // Subtotal = totalAmount (client-provided item sum before tax/discount)
  const rawSubtotal = Number(orderData.totalAmount) || 0;
  const discountAmt = Number(orderData.discountAmount) || 0;
  const taxableSubtotal = rawSubtotal - discountAmt;

  // Resolve the correct tax based on actual payment methods
  const { taxAmount, appliedTaxRate, appliedTaxLabel } = resolveAppliedTax(
    payments || [],
    cashTaxEnabled,
    cardTaxEnabled,
    cashTaxRate,
    cardTaxRate,
    cashTaxLabel,
    cardTaxLabel,
    taxableSubtotal,
    roundingMethod,
    orderData.taxAmount
  );

  // Server overrides client-sent taxAmount and netAmount
  const serverNetAmount = taxableSubtotal + taxAmount;

  if (orderData.netAmount !== undefined && Math.abs(Number(orderData.netAmount) - serverNetAmount) > 1) {
    const err: any = new Error(`Tax calculation mismatch. Client sent: ${orderData.netAmount}, Server calculated: ${serverNetAmount}`);
    err.statusCode = 422;
    throw err;
  }

  // ── Order fields with tax snapshots ─────────────────────────────────────────
  const taxAuditFields = {
    taxAmount,
    netAmount: serverNetAmount,
    cashTaxRate: cashTaxRate / 100,   // store as decimal fraction for consistency
    cardTaxRate: cardTaxRate / 100,
    appliedTaxRate,
    appliedTaxLabel,
  };

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        ...orderData,
        tenantId,
        branchId,
        orderNumber,
        tokenNumber,
        ...taxAuditFields,
        items: { create: routedItems },
        ...(payments?.length > 0 && { payments: { create: payments } }),
        ...(orderDeals?.length > 0 && { orderDeals: { create: orderDeals } }),
      },
      include: { items: true, payments: true, orderDeals: true },
    });

    // Inventory auto-deduct is now handled asynchronously when order is COMPLETED.

    return created;
  });

  // Auto-create/update customer profile — fire-and-forget, doesn't need to
  // complete before the order is returned and sent to the kitchen.
  if (customerPhone) {
    // Basic phone normalization
    let phone = customerPhone.replace(/[\s-]/g, '');
    if (phone.startsWith('03')) phone = '+923' + phone.slice(2);

    prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      create: {
        tenantId,
        name: customerName ?? 'Guest',
        phone,
        totalOrders: 1,
        totalSpend: order.netAmount,
        lastVisitAt: new Date()
      },
      update: {
        name: customerName !== undefined ? customerName : undefined,
        totalOrders: { increment: 1 },
        totalSpend: { increment: order.netAmount },
        lastVisitAt: new Date()
      }
    }).catch(e => console.error('Auto-create customer error:', e));
  }

  // Low stock push notifications — fire-and-forget, must not delay the
  // response (and therefore the socket emit that sends the order to the kitchen).
  const itemIdsForOrder = [...new Set(order.items.map((i: any) => i.itemId))];
  if (itemIdsForOrder.length > 0) {
    prisma.recipe.findMany({
      where: { tenantId, itemId: { in: itemIdsForOrder } },
      include: { lines: true },
    }).then((recipes) => {
      const ingredientIds = [...new Set(recipes.flatMap((r) => r.lines.map((l) => l.ingredientId)))];
      return Promise.all(
        ingredientIds.map((ingredientId) => sendLowStockIfNeeded({ tenantId, branchId, ingredientId }))
      );
    }).catch(e => console.error('Low stock notification error:', e));
  }

  enqueueZapierEvent({ tenantId, event: 'order.created', payload: order }).catch(() => {});

  // Asynchronously process loyalty redemption (if any) during order creation
  if (orderData.redeemedPointsAmount) {
    redeemLoyaltyForOrder(order, orderData.redeemedPointsAmount).catch(e => console.error('Loyalty Redeem Error:', e));
  }

  // Trigger Analytics Aggregation
  analyticsQueue.add('aggregate', { 
    tenantId, 
    branchId, 
    date: new Date().toISOString() 
  }, { removeOnComplete: true }).catch(e => console.error('Analytics Job Error:', e));
  
  return order;
}


export async function listOrders(
  tenantId: string,
  scopedBranchId: string | undefined,
  query: { branchId?: string; status?: string; limit: number; cursor?: string; tableId?: string },
) {
  const branchId = scopedBranchId || query.branchId;
  const statusList = query.status?.split(',').filter(Boolean);

  let tz = 'Asia/Karachi';
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (branch?.timezone) tz = branch.timezone;
  }

  const zonedNow = toZonedTime(new Date(), tz);
  zonedNow.setHours(0, 0, 0, 0);
  const todayStart = fromZonedTime(zonedNow, tz);

  const orders = await prisma.order.findMany({
    take: query.limit + 1,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    where: {
      tenantId,
      ...(branchId && { branchId }),
      ...(query.tableId && { tableId: query.tableId }),
      ...(statusList && statusList.length > 0 ? { status: { in: statusList as any[] } } : {}),
      ...(!query.tableId && { createdAt: { gte: todayStart } }),
    },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { item: { select: { name: true } } } }, payments: true },
  });

  let nextCursor: string | undefined;
  if (orders.length > query.limit) {
    const nextItem = orders.pop()!;
    nextCursor = nextItem.id;
  }
  return { data: orders, nextCursor };
}

export async function listActiveOrders(tenantId: string, branchId: string) {
  const startOfToday = new Date(); 
  startOfToday.setHours(0,0,0,0);
  
  const where = {
    branchId, 
    tenantId,
    status: { in: ['PENDING','CONFIRMED','IN_KITCHEN','READY'] as const },
    createdAt: { gte: startOfToday }
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      items: { include: { item: { select: { name: true } }, modifiers: true } },
      branch: { select: { name: true } },
      shift: { include: { user: { select: { name: true } } } },
      table: { select: { label: true } },
      customer: true
    },
  });

  const now = Date.now();
  return orders.map(o => {
    const elapsedMinutes = Math.floor((now - o.createdAt.getTime()) / 60000);
    const totalItems = o.items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      type: o.type,
      source: o.source,
      netAmount: o.netAmount,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      elapsedMinutes,
      items: o.items.map(i => ({
        id: i.id,
        name: i.item?.name || 'Unknown Item',
        quantity: i.quantity,
        subtotal: i.subtotal,
        options: i.options,
        notes: i.notes
      })),
      tableLabel: o.table?.label ?? o.tableLabel ?? null,
      customerName: o.customer?.name ?? o.customerName ?? null,
      customerPhone: o.customer?.phone ?? o.customerPhone ?? null,
      totalItems,
      branchName: o.branch.name,
      cashierName: o.shift?.user?.name ?? 'N/A',
      waiterName: o.assignedWaiterName ?? null,
    };
  });
}


export async function listOrderHistory(
  tenantId: string,
  scopedBranchId: string | undefined,
  query: {
    page: number; limit: number; search?: string;
    dateFrom?: string; dateTo?: string; branchId?: string;
    type?: string; status?: string; paymentMethod?: string;
    cashierId?: string;
    waiterId?: string;
  },
) {
  const effectiveBranchId = scopedBranchId || query.branchId;
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
  const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  const searchClause = query.search
    ? {
        OR: [
          { orderNumber: { contains: query.search.replace('#', ''), mode: 'insensitive' as const } },
          { table: { label: { contains: query.search, mode: 'insensitive' as const } } }
        ]
      }
    : {};

  const where: any = {
    tenantId,
    ...(effectiveBranchId && { branchId: effectiveBranchId }),
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
    ...(query.cashierId && { shift: { userId: query.cashierId } }),
    ...(query.waiterId && { assignedWaiterId: query.waiterId }),
    ...(query.paymentMethod && { payments: { some: { method: query.paymentMethod } } }),
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } } : {}),
    ...searchClause,
  };

  const [total, rawOrders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        type: true,
        tokenNumber: true,
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
        netAmount: true,
        status: true,
        branch: { select: { name: true } },
        table: { select: { label: true } },
        shift: { select: { user: { select: { name: true } } } },
        assignedWaiterName: true,
        _count: { select: { items: true } },
        payments: { select: { method: true }, take: 1 },
      },
    }),
  ]);

  let tz = 'Asia/Karachi';
  if (effectiveBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: effectiveBranchId } });
    if (branch?.timezone) tz = branch.timezone;
  }
  const zonedNow = toZonedTime(new Date(), tz);
  zonedNow.setHours(0, 0, 0, 0);
  const todayStart = fromZonedTime(zonedNow, tz);
  const summaryWhere: any = {
    tenantId, ...(effectiveBranchId && { branchId: effectiveBranchId }),
    ...(!query.dateFrom && !query.dateTo ? { createdAt: { gte: todayStart } }
      : (dateFrom || dateTo) ? { createdAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } } : {}),
  };
  const summaryAgg = await prisma.order.aggregate({
    where: { ...summaryWhere, status: { not: 'CANCELLED' } },
    _count: { id: true }, _sum: { netAmount: true },
  });

  const mapOrder = (o: any) => ({
    id: o.id,
    orderNumber: String(o.orderNumber || o.id.slice(-4)).padStart(4, '0'),
    dateTime: o.createdAt.toISOString(),
    branchName: o.branch?.name ?? '',
    type: o.type, customerName: null as string | null,
    tableLabel: o.table?.label ?? null, token: o.tokenNumber ?? null,
    itemCount: o._count?.items ?? 0,
    subtotal: o.totalAmount ?? 0, tax: o.taxAmount ?? 0,
    discount: o.discountAmount ?? 0, total: o.netAmount ?? 0,
    status: o.status, paymentMethod: o.payments?.[0]?.method ?? 'CASH',
    cashierName: o.shift?.user?.name ?? 'N/A',
    waiterName: o.assignedWaiterName ?? null,
  });

  return {
    orders: rawOrders.map(mapOrder),
    pagination: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    summary: { totalRevenue: summaryAgg._sum.netAmount ?? 0, totalOrders: summaryAgg._count.id ?? 0 },
  };
}

const LIVE_ORDERS_CACHE_TTL_SECONDS = 4;

export async function listLiveOrders(tenantId: string, branchId: string | undefined) {
  const cacheKey = `live-orders:${tenantId}:${branchId ?? 'all'}`;
  const cached = await upstash.get(cacheKey).catch(() => null);
  if (cached) return cached;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = Date.now();

  // Active orders and today's summary source data are independent — fetch
  // concurrently. (Previously this also re-fetched the last 20 completed
  // orders in full with all relations, but the result was never used.)
  const [activeOrders, todayOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { include: { item: { select: { name: true } } } },
        branch: { select: { name: true } },
        shift: { include: { user: { select: { name: true } } } },
        table: { select: { label: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        tenantId,
        ...(branchId && { branchId }),
        createdAt: { gte: todayStart },
        status: { not: 'CANCELLED' },
      },
      select: { netAmount: true, status: true, createdAt: true, updatedAt: true },
    }),
  ]);

  const allOrders = activeOrders;

  // Map to the enriched shape
  const mapOrder = (o: any) => ({
    id: o.id,
    orderNumber: String(o.orderNumber || o.id.slice(-4)).padStart(3, '0'),
    status: o.status,
    type: o.type,
    tableLabel: o.table?.label ?? null,
    token: o.tokenNumber ?? null,
    customerName: null, // extend later from CRM
    items: (o.items || []).map((it: any) => ({
      name: it.item?.name ?? 'Item',
      qty: it.quantity,
      variation: null,
    })),
    total: o.netAmount ?? 0,
    cashierName: o.shift?.user?.name ?? 'N/A',
    cashierId: o.shift?.userId ?? null,
    branchName: o.branch?.name ?? '',
    branchId: o.branchId,
    createdAt: o.createdAt.toISOString(),
    completedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
    minutesElapsed: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
  });

  // Summary KPIs for today — derived from the todayOrders fetched above
  // (COMPLETED is a subset of it, no need for a separate query).
  const todayOrderCount = todayOrders.length;
  const completedTodayOrders = todayOrders.filter((o) => o.status === 'COMPLETED');
  const todayRevenue = completedTodayOrders.reduce((s, o) => s + (o.netAmount ?? 0), 0);
  const inProgressCount = activeOrders.length;

  const avgPrepSeconds = completedTodayOrders.length > 0
    ? completedTodayOrders.reduce((sum, o) =>
        sum + (o.updatedAt.getTime() - o.createdAt.getTime()), 0
      ) / completedTodayOrders.length / 1000
    : 0;

  const avgPrepTime = Math.round(avgPrepSeconds / 60);

  const result = {
    orders: allOrders.map(mapOrder),
    summary: { todayOrderCount, todayRevenue, avgPrepTime, inProgressCount },
  };

  upstash.set(cacheKey, result, { ex: LIVE_ORDERS_CACHE_TTL_SECONDS }).catch((e) =>
    console.error('Failed to cache live orders:', e)
  );

  return result;
}


export async function getActiveCount(tenantId: string, branchId: string | undefined) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const count = await prisma.order.count({
    where: {
      tenantId,
      ...(branchId && { branchId }),
      status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] as any },
      createdAt: { gte: todayStart },
    },
  });
  return { count };
}

export async function getOrder(tenantId: string, id: string) {
  return prisma.order.findUnique({
    where: { id, tenantId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      shift: { select: { id: true, userId: true, openedAt: true } },
      payments: true,
      VoidRequest: true,
      table: true,
      assignedWaiter: { select: { id: true, name: true } },
      items: { include: { item: { select: { name: true, image: true } } } },
    },
  });
}

export async function updateOrder(tenantId: string, id: string, data: any) {
  const { items, payments, orderDeals, ...orderData } = data;

  const existingOrder = await prisma.order.findUnique({ where: { id, tenantId } });
  if (!existingOrder) throw new Error('Order not found');

  if (payments && payments.length > 0) {
    const tenantBranding = await prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        cashTaxEnabled: true, cashTaxRate: true, cashTaxLabel: true,
        cardTaxEnabled: true, cardTaxRate: true, cardTaxLabel: true,
        taxRoundingMethod: true,
      },
    });

    const cashTaxEnabled = tenantBranding?.cashTaxEnabled ?? true;
    const cashTaxRate = tenantBranding?.cashTaxRate ?? 5;
    const cardTaxEnabled = tenantBranding?.cardTaxEnabled ?? true;
    const cardTaxRate = tenantBranding?.cardTaxRate ?? 17;
    const cashTaxLabel = tenantBranding?.cashTaxLabel ?? 'GST (Cash)';
    const cardTaxLabel = tenantBranding?.cardTaxLabel ?? 'GST (Card/Digital)';
    const roundingMethod = tenantBranding?.taxRoundingMethod ?? 'ROUND';

    const taxableSubtotal = Number(existingOrder.totalAmount) - Number(existingOrder.discountAmount);

    const { taxAmount, appliedTaxRate, appliedTaxLabel } = resolveAppliedTax(
      payments,
      cashTaxEnabled,
      cardTaxEnabled,
      cashTaxRate,
      cardTaxRate,
      cashTaxLabel,
      cardTaxLabel,
      taxableSubtotal,
      roundingMethod,
    );

    Object.assign(orderData, {
      taxAmount,
      netAmount: taxableSubtotal + taxAmount,
      cashTaxRate: cashTaxRate / 100,
      cardTaxRate: cardTaxRate / 100,
      appliedTaxRate,
      appliedTaxLabel,
    });
  }

  if (items && Array.isArray(items)) {
    const routedItems = await routeItemsToKdsStations(tenantId, existingOrder.branchId, items);

    return prisma.order.update({
      where: { id, tenantId },
      data: {
        ...orderData,
        items: {
          deleteMany: {},
          create: routedItems,
        },
        ...(payments?.length > 0 && {
          payments: {
            deleteMany: {},
            create: payments
          }
        }),
        ...(orderDeals?.length > 0 && {
          orderDeals: {
            deleteMany: {},
            create: orderDeals
          }
        })
      },
      include: { items: true, orderDeals: true },
    });
  }

  return prisma.order.update({
    where: { id, tenantId },
    data: {
      ...orderData,
      ...(payments?.length > 0 && {
        payments: {
          deleteMany: {},
          create: payments
        }
      }),
      ...(orderDeals?.length > 0 && {
        orderDeals: {
          deleteMany: {},
          create: orderDeals
        }
      })
    },
    include: { items: true, payments: true, orderDeals: true },
  });
}

export async function appendOrderItems(tenantId: string, id: string, newItems: any[]) {
  const existingOrder = await prisma.order.findUnique({
    where: { id, tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
  });

  if (!existingOrder) throw new Error('Order not found or already completed');

  // Simple recalculation as requested by the user
  const newItemsTotal = newItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const newSubtotal = Number(existingOrder.totalAmount) + newItemsTotal;
  const taxableSubtotal = newSubtotal - Number(existingOrder.discountAmount);
  // Using simple rounding for the total netAmount
  const netAmount = taxableSubtotal + Number(existingOrder.taxAmount); // Assume tax recalculation later or simple sum

  const [_, updatedOrder] = await prisma.$transaction([
    prisma.orderItem.createMany({ 
      data: newItems.map((i: any) => ({ ...i, orderId: id })) 
    }),
    prisma.order.update({ 
      where: { id }, 
      data: {
        totalAmount: newSubtotal,
        netAmount: netAmount,
        status: ['DELIVERED', 'READY', 'BILL_REQUESTED'].includes(existingOrder.status) ? 'IN_KITCHEN' : undefined,
      }
    })
  ]);

  const io = getIO();
  if (io) {
    io.to(`branch:${updatedOrder.branchId}`).emit('order:updated', { orderId: id });
  }

  return updatedOrder;
}

export async function enqueueOrderEvents(
  tenantId: string,
  order: any,
  payments?: any[],
  redeemedPointsAmount?: number
) {
  await enqueueZapierEvent({ tenantId, event: 'order.updated', payload: order }).catch(() => {});
  if (order.status === 'CANCELLED') {
    await enqueueZapierEvent({ tenantId, event: 'order.cancelled', payload: order }).catch(() => {});
  }
  if (order.status === 'COMPLETED') {
    // Process earning when order is completed
    earnLoyaltyForOrder(order).catch(e => console.error('Loyalty Earn Error:', e));
    
    // Process redemption if passed during payment completion
    if (redeemedPointsAmount) {
      redeemLoyaltyForOrder(order, redeemedPointsAmount).catch(e => console.error('Loyalty Redeem Error:', e));
    }

    deductInventoryForOrder(order.id).catch(e => console.error('Inventory Deduction Error:', e));
    await enqueueZapierEvent({ tenantId, event: 'order.completed', payload: order }).catch(() => {});
    await erpSyncQueue.add('erp.sync', { tenantId }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: true,
    }).catch(() => {});
    emitDashboardStatsUpdated(tenantId, order.branchId);

    // Update Deal usage counters
    try {
      const orderDeals = await prisma.orderDeal.findMany({ where: { orderId: order.id } });
      for (const od of orderDeals) {
        if (od.dealId) {
          await prisma.deal.updateMany({
            where: { id: od.dealId },
            data: { usedCount: { increment: 1 } }
          });
        }
      }
    } catch (e) {
      console.error('Failed to update deal usage:', e);
    }
  } else if (payments && payments.length > 0) {
    emitDashboardStatsUpdated(tenantId, order.branchId);
  }
}

export async function assignOrder(tenantId: string, id: string, data: { waiterId: string; waiterName: string }) {
  return prisma.order.update({
    where: { id, tenantId },
    data: {
      assignedWaiterId: data.waiterId,
      assignedWaiterName: data.waiterName,
      assignedAt: new Date()
    },
    include: {
      assignedWaiter: { select: { avatarColor: true } }
    }
  });
}

export async function deleteOrderItem(
  tenantId: string,
  orderId: string,
  itemId: string,
  data: { reason: string; quantity: number; approvedByManagerId?: string },
  cashierId: string
) {
  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId }
  });

  if (branding?.voidRequiresManagerApproval && !data.approvedByManagerId) {
    throw new Error('Manager approval is required for voids');
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId, order: { tenantId } },
    include: { item: true }
  });

  if (!orderItem) {
    // If it's already gone (e.g., previous partial crash), just recalculate the order totals
    const remainingItems = await prisma.orderItem.findMany({ where: { orderId } });
    const taxableSubtotal = remainingItems.reduce((acc, i) => acc + i.subtotal, 0);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order) throw new Error('Order not found');

    const tenantBranding = await prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        cashTaxEnabled: true, cashTaxRate: true, cashTaxLabel: true,
        cardTaxEnabled: true, cardTaxRate: true, cardTaxLabel: true,
        taxRoundingMethod: true,
      },
    });

    const cashTaxEnabled = tenantBranding?.cashTaxEnabled ?? true;
    const cashTaxRate = tenantBranding?.cashTaxRate ?? 5;
    const cardTaxEnabled = tenantBranding?.cardTaxEnabled ?? true;
    const cardTaxRate = tenantBranding?.cardTaxRate ?? 17;
    const cashTaxLabel = tenantBranding?.cashTaxLabel ?? 'GST';
    const cardTaxLabel = tenantBranding?.cardTaxLabel ?? 'GST';
    const taxRoundingMethod = tenantBranding?.taxRoundingMethod ?? 'ROUND';

    const { taxAmount, appliedTaxRate, appliedTaxLabel } = resolveAppliedTax(
      order.payments, cashTaxEnabled, cardTaxEnabled, cashTaxRate, cardTaxRate,
      cashTaxLabel, cardTaxLabel, taxableSubtotal, taxRoundingMethod || 'ROUND',
    );

    return prisma.order.update({
      where: { id: orderId },
      data: {
        totalAmount: taxableSubtotal, taxAmount, netAmount: taxableSubtotal + taxAmount,
        cashTaxRate: cashTaxRate / 100, cardTaxRate: cardTaxRate / 100, appliedTaxRate, appliedTaxLabel,
      },
      include: { items: { include: { item: { select: { name: true, image: true } } } }, payments: true, table: true, assignedWaiter: true }
    });
  }

  if (data.quantity > orderItem.quantity) {
    throw new Error('Cannot void more items than ordered');
  }

  let itemName = orderItem.item.name;

  if (data.quantity === orderItem.quantity) {
    await prisma.orderItem.delete({
      where: { id: itemId }
    });
  } else {
    await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity: orderItem.quantity - data.quantity,
        subtotal: (orderItem.quantity - data.quantity) * orderItem.unitPrice
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'ITEM_VOIDED',
      notes: `Item voided: ${data.quantity}x ${itemName}. Reason: ${data.reason}`,
      after: {
        orderId,
        orderItemId: itemId,
        itemName,
        quantity: data.quantity,
        reason: data.reason,
        cashierId,
        approvedByManagerId: data.approvedByManagerId
      } as any,
      targetTenantId: tenantId
    }
  });

  // Re-fetch items and recalculate total
  const remainingItems = await prisma.orderItem.findMany({
    where: { orderId }
  });

  const taxableSubtotal = remainingItems.reduce((acc, i) => acc + i.subtotal, 0);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true }
  });
  
  if (!order) throw new Error('Order not found');

  const tenantBranding = await prisma.tenantBranding.findUnique({
    where: { tenantId },
    select: {
      cashTaxEnabled: true, cashTaxRate: true, cashTaxLabel: true,
      cardTaxEnabled: true, cardTaxRate: true, cardTaxLabel: true,
      taxRoundingMethod: true,
    },
  });

  const cashTaxEnabled = tenantBranding?.cashTaxEnabled ?? true;
  const cashTaxRate = tenantBranding?.cashTaxRate ?? 5;
  const cardTaxEnabled = tenantBranding?.cardTaxEnabled ?? true;
  const cardTaxRate = tenantBranding?.cardTaxRate ?? 17;
  const cashTaxLabel = tenantBranding?.cashTaxLabel ?? 'GST';
  const cardTaxLabel = tenantBranding?.cardTaxLabel ?? 'GST';
  const taxRoundingMethod = tenantBranding?.taxRoundingMethod ?? 'ROUND';


  const { taxAmount, appliedTaxRate, appliedTaxLabel } = resolveAppliedTax(
    order.payments,
    cashTaxEnabled,
    cardTaxEnabled,
    cashTaxRate,
    cardTaxRate,
    cashTaxLabel,
    cardTaxLabel,
    taxableSubtotal,
    taxRoundingMethod || 'ROUND',
  );

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      totalAmount: taxableSubtotal,
      taxAmount,
      netAmount: taxableSubtotal + taxAmount,
      cashTaxRate: cashTaxRate / 100,
      cardTaxRate: cardTaxRate / 100,
      appliedTaxRate,
      appliedTaxLabel,
    },
    include: { 
      items: {
        include: {
          item: { select: { name: true, image: true } }
        }
      }, 
      payments: true, 
      table: true, 
      assignedWaiter: true 
    }
  });

  return updatedOrder;
}
