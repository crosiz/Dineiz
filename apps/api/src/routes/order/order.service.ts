import { prisma } from '@dineiz/db';
import { upstash } from '../../lib/redis';
import { generateOrderNumber, generateTokenNumber } from '../../lib/tokenGenerator';
import { emitDashboardStatsUpdated, emitOrderUpdated, emitOrderCancelled } from '../../lib/socket';
import { recomputeTableStatus, markTableOrderCompleted } from '../../lib/tableStatus';
import { incrementShiftAggregate, decrementShiftAggregate, getBranchTodayAggregate } from '../../lib/shiftAggregate';
import { invalidatePattern } from '../../lib/cache';
import { sendLowStockIfNeeded } from '../../lib/lowStock';
import { enqueueZapierEvent } from '../../lib/webhooks';
import { erpSyncQueue, analyticsQueue } from '../../lib/queue';
import { redeemLoyaltyForOrder, earnLoyaltyForOrder } from '../loyalty/loyalty.service';
import { deductInventoryForOrder, reverseOrDiscardInventoryForCancelledOrder } from '../inventory/inventory.service';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getTodayOrdersWhere } from '../../lib/date-utils';
import { recordOrderCompleted, recordOrderVoided } from '../shift/shift-activity';

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
  const {
    items, payments, orderDeals, branchId, cashierId, customerPhone, customerName,
    // Part 4 — the terminal owns the order number. Pulled out of `orderData`
    // both so it doesn't get double-applied and so `clientId` (not a column)
    // never reaches prisma.order.create.
    orderNumber: clientOrderNumber, clientId: _clientId,
    ...orderData
  } = body;

  // ── Independent lookups run concurrently instead of as a sequential waterfall ──
  const [, tenantBranding, resolvedOrderNumber, tokenNumber, routedItems] = await Promise.all([
    checkPlanLimits(tenantId),
    prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        cashTaxEnabled: true, cashTaxRate: true, cashTaxLabel: true,
        cardTaxEnabled: true, cardTaxRate: true, cardTaxLabel: true,
        taxRoundingMethod: true,
      },
    }),
    // Only needed when the caller didn't bring its own number (non-POS
    // sources, or a POS build from before Part 4).
    typeof clientOrderNumber === 'string' && clientOrderNumber.trim()
      ? Promise.resolve(clientOrderNumber.trim())
      : generateOrderNumber(tenantId),
    generateTokenNumber(branchId, userId),
    routeItemsToKdsStations(tenantId, branchId, items),
  ]);
  const trustClientNumber = typeof clientOrderNumber === 'string' && !!clientOrderNumber.trim();

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

  // A nested-write create() is already atomic in Postgres/Prisma on its own —
  // this used to also do inventory auto-deduct here, which is why it was
  // wrapped in an explicit interactive $transaction. That's now handled
  // asynchronously when an order is COMPLETED, leaving a single create()
  // call as the only thing in the transaction body. An explicit interactive
  // transaction around one operation is pure overhead (an extra BEGIN/COMMIT
  // round-trip) and, worse, subject to Prisma's default 5s interactive-
  // transaction timeout — on a higher-latency DB connection, the handful of
  // round-trips a single order create + include triggers can exceed that
  // and abort the whole order with a P2028 error. Calling create() directly
  // keeps the same atomicity guarantee without either problem.
  //
  // orderNumber has a @@unique([tenantId, orderNumber]) constraint.
  //   • Server-generated number (non-POS / fallback): generateOrderNumber()'s
  //     Redis INCR is collision-free, but its Redis-down fallback truncates
  //     Date.now() and can collide — regenerate and retry.
  //   • Client-supplied number (Part 4, POS): the terminal owns it and it's
  //     unique by construction (terminal prefix + date + per-terminal seq).
  //     A collision here almost always means an idempotent replay whose
  //     X-Idempotency-Key didn't reach withIdempotency — return the order
  //     that's already there rather than mint a different number for it.
  let currentOrderNumber = resolvedOrderNumber;
  let order;
  for (let attempt = 0; ; attempt++) {
    try {
      order = await prisma.order.create({
        data: {
          ...orderData,
          tenantId,
          branchId,
          orderNumber: currentOrderNumber,
          tokenNumber,
          ...taxAuditFields,
          items: { create: routedItems },
          ...(payments?.length > 0 && { payments: { create: payments } }),
          ...(orderDeals?.length > 0 && { orderDeals: { create: orderDeals } }),
        },
        include: { items: true, payments: true, orderDeals: true },
      });
      break;
    } catch (e: any) {
      const isOrderNumberCollision = e?.code === 'P2002' && e?.meta?.target?.includes?.('orderNumber');
      if (!isOrderNumberCollision) throw e;

      if (trustClientNumber) {
        const existing = await prisma.order.findUnique({
          where: { tenantId_orderNumber: { tenantId, orderNumber: currentOrderNumber } },
          include: { items: true, payments: true, orderDeals: true },
        });
        if (existing && existing.branchId === branchId) {
          console.warn(`[createOrder] client orderNumber "${currentOrderNumber}" already exists — returning it (idempotent replay)`);
          return existing;
        }
        const err: any = new Error(`Order number "${currentOrderNumber}" is already in use`);
        err.statusCode = 409;
        throw err;
      }

      if (attempt >= 2) throw e;
      console.warn(`[createOrder] orderNumber collision on "${currentOrderNumber}", regenerating (attempt ${attempt + 1})`);
      currentOrderNumber = await generateOrderNumber(tenantId);
    }
  }

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

  invalidateLiveOrdersCache(tenantId, branchId);

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
    type?: string; status?: string; paymentMethod?: string; source?: string;
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
    ...(query.source && { source: query.source }),
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
        source: true,
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
    orderNumber: o.orderNumber ? String(o.orderNumber) : `#${o.id.slice(-4)}`,
    dateTime: o.createdAt.toISOString(),
    branchName: o.branch?.name ?? '',
    type: o.type, source: o.source, customerName: null as string | null,
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

// The TTL above is short, but the cache was never actively invalidated on
// writes — a new/updated order could sit invisible on the live board for up
// to the full TTL on top of the client's own poll interval. Call this after
// any mutation that changes what the live board should show (create,
// status/void update, item append, item delete). Both the branch-scoped and
// tenant-wide ('all') keys are cleared since either could have been serving
// a view that included this branch.
function invalidateLiveOrdersCache(tenantId: string, branchId?: string | null) {
  const keys = [`live-orders:${tenantId}:all`];
  if (branchId) keys.push(`live-orders:${tenantId}:${branchId}`);
  Promise.all(keys.map((k) => upstash.del(k))).catch((e) =>
    console.error('Failed to invalidate live-orders cache:', e)
  );
}

export async function listLiveOrders(
  tenantId: string,
  branchId: string | undefined,
  opts?: { shiftId?: string | null },
) {
  // The shared cache only covers the branch-wide board (the expensive
  // open-shift lookup). A cashier's shift-scoped board is a cheap indexed
  // `where: { shiftId }` and per-cashier, so it skips the cache entirely —
  // that also sidesteps having to thread shiftId through the 9
  // invalidateLiveOrdersCache call sites.
  const useCache = !opts?.shiftId;
  const cacheKey = `live-orders:${tenantId}:${branchId ?? 'all'}`;
  if (useCache) {
    const cached = await upstash.get(cacheKey).catch(() => null);
    if (cached) return cached;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = Date.now();

  // Spec Part 2 — Shift Ownership. With opts.shiftId this is exactly that
  // cashier's shift; without it, orders under any currently-OPEN shift at the
  // branch plus shiftless orders from today. Orphans (still-active orders
  // under a closed shift) are excluded — they go through the orphan flow.
  const todayOrdersWhere = await getTodayOrdersWhere(tenantId, branchId, opts);

  // Active orders and today's summary source data are independent — fetch
  // concurrently. (Previously this also re-fetched the last 20 completed
  // orders in full with all relations, but the result was never used.)
  const [activeOrders, todayOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
        ...todayOrdersWhere,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { include: { item: { select: { name: true } } } },
        branch: { select: { name: true } },
        shift: { include: { user: { select: { name: true } } } },
        table: { select: { label: true } },
        customer: { select: { name: true, phone: true } },
        payments: { select: { method: true, status: true } },
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
    orderNumber: o.orderNumber ? String(o.orderNumber) : `#${o.id.slice(-4)}`,
    status: o.status,
    type: o.type,
    source: o.source,
    tableLabel: o.table?.label ?? null,
    token: o.tokenNumber ?? null,
    customerName: o.customer?.name ?? null,
    customerPhone: o.customer?.phone ?? null,
    payments: (o.payments || []).map((p: any) => ({ method: p.method, status: p.status })),
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

  if (useCache) {
    upstash.set(cacheKey, result, { ex: LIVE_ORDERS_CACHE_TTL_SECONDS }).catch((e) =>
      console.error('Failed to cache live orders:', e)
    );
  }

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
  // clientId / orderNumber ride along on the create schema (Part 4) but a PUT
  // must never rewrite an order's identity — drop them here.
  const { items, payments, orderDeals, clientId: _clientId, orderNumber: _orderNumber, ...orderData } = data;

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

    const serverNet = taxableSubtotal + taxAmount;
    Object.assign(orderData, {
      taxAmount,
      netAmount: serverNet,
      cashTaxRate: cashTaxRate / 100,
      cardTaxRate: cardTaxRate / 100,
      appliedTaxRate,
      appliedTaxLabel,
    });

    // ── Financial integrity guards (spec Part 12) ──────────────────────────
    const completing = orderData.status === 'COMPLETED' || existingOrder.status !== 'COMPLETED';
    if (completing) {
      const paid = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      // The money tendered must cover the (server-recomputed) total. A small
      // rounding tolerance; anything more is rejected, never silently accepted.
      if (paid + 1 < serverNet) {
        const err: any = new Error(`Payment total PKR ${paid.toFixed(0)} is less than the order total PKR ${serverNet.toFixed(0)}`);
        err.statusCode = 422;
        throw err;
      }
      // A zero/negative-total completion is only legitimate with an explicit
      // manager approval, and it's always worth flagging.
      if (serverNet <= 0 && !orderData.managerApprovalId && !(orderData as any).approvedByManagerId) {
        const err: any = new Error('A zero-total order can only be completed with manager approval');
        err.statusCode = 422;
        throw err;
      }
      if (serverNet <= 0) {
        console.error(`[order] CRITICAL zero-total completion: order ${id} tenant ${tenantId} approvedBy ${orderData.managerApprovalId ?? (orderData as any).approvedByManagerId}`);
      }
    }
  }
  // `managerApprovalId` / `approvedByManagerId` are audit inputs, not Order
  // columns — strip so `...orderData` can't reach prisma.order.update.
  delete (orderData as any).managerApprovalId;
  delete (orderData as any).approvedByManagerId;

  if (items && Array.isArray(items)) {
    const routedItems = await routeItemsToKdsStations(tenantId, existingOrder.branchId, items);

    const updated = await prisma.order.update({
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
    invalidateLiveOrdersCache(tenantId, existingOrder.branchId);
    return updated;
  }

  const updated = await prisma.order.update({
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
  invalidateLiveOrdersCache(tenantId, existingOrder.branchId);
  return updated;
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

  invalidateLiveOrdersCache(tenantId, updatedOrder.branchId);

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
    recordOrderVoided(order, { amount: Number(order.netAmount ?? 0), wholeOrder: true });
    await enqueueZapierEvent({ tenantId, event: 'order.cancelled', payload: order }).catch(() => {});
    // If this order had already completed (a rare reopen-then-void), back it
    // out of the shift's running totals (spec Part 7 / Part 12).
    if (order.sideEffectsAppliedAt) {
      await decrementShiftAggregate(order, order.payments);
      await broadcastShiftTotals(tenantId, order.branchId);
    }
  }
  if (order.status === 'COMPLETED') {
    // Atomic claim: this bundle (inventory deduction, loyalty earn, deal
    // counters, Zapier, ERP sync) must fire at most once per order, ever.
    // A retried/duplicated PUT (the outbox's own retry-with-backoff makes
    // this a real, expected occurrence — not just a hypothetical) used to
    // re-run all of it every time it observed status === 'COMPLETED', with
    // no check for whether it already had been. Racing this on `WHERE
    // sideEffectsAppliedAt IS NULL` means only one concurrent request can
    // ever win the claim — the loser sees claim.count === 0 and skips the
    // whole block instead of re-firing it.
    const claim = await prisma.order.updateMany({
      where: { id: order.id, sideEffectsAppliedAt: null },
      data: { sideEffectsAppliedAt: new Date() },
    });

    if (claim.count === 1) {
      // Spec Part 7 — fold this order into the shift's running money totals.
      // This runs exactly once per order (the claim above is the latch), so
      // it is the atomic "record the payment" point the dashboard reads back
      // as a single row. Awaited (not fire-and-forget) so the broadcast
      // below carries the fresh number.
      await incrementShiftAggregate({ ...order, payments: payments ?? order.payments }, payments ?? order.payments);

      // Writes the ORDER_COMPLETED (and DISCOUNT_APPLIED) lines the Shift
      // Management timeline and the shift PDF are built from. Fire-and-forget
      // by design — see shift-activity.ts.
      recordOrderCompleted({ ...order, payments: payments ?? order.payments });
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
      // Spec Part 7 — bust the dashboard cache and push the fresh totals so
      // the number moves within a second, no polling.
      await broadcastShiftTotals(tenantId, order.branchId);

      // Update Deal usage counters — one round trip per deal line
      // sequentially used to serialize N DB calls that don't depend on each
      // other; running them concurrently is safe since each is its own
      // atomic increment (Postgres handles concurrent increments on the
      // same row correctly, so two lines using the same deal just both add
      // 1, same net result as before).
      try {
        const orderDeals = await prisma.orderDeal.findMany({ where: { orderId: order.id } });
        await Promise.all(
          orderDeals
            .filter((od) => od.dealId)
            .map((od) =>
              prisma.deal.updateMany({
                where: { id: od.dealId! },
                data: { usedCount: { increment: 1 } },
              })
            )
        );
      } catch (e) {
        console.error('Failed to update deal usage:', e);
      }
    }
  } else if (payments && payments.length > 0) {
    await broadcastShiftTotals(tenantId, order.branchId);
  }
}

// Bust the dashboard-summary cache for this tenant/branch and broadcast the
// freshly-summed shift totals (spec Part 7). Best-effort — the number is
// still correct on the next read even if Redis/socket is down.
async function broadcastShiftTotals(tenantId: string, branchId: string): Promise<void> {
  try {
    await invalidatePattern(`dash:summary:${tenantId}:*`);
    await invalidatePattern(`dash:summary:${tenantId}:all:*`);
  } catch { /* ignore */ }
  try {
    const totals = await getBranchTodayAggregate(tenantId, branchId);
    emitDashboardStatsUpdated(tenantId, branchId, totals);
  } catch (e: any) {
    console.warn('[broadcastShiftTotals] failed:', e?.message);
    emitDashboardStatsUpdated(tenantId, branchId);
  }
}

// Everything that has to happen after ANY order status write, regardless of
// which route drove it. Originally only handleUpdateOrder (PUT
// /api/orders/:id) ran this — the KDS "deliver"/"cancel" transitions
// (kds.service.ts) and the mobile app's status-update endpoint
// (mobile/orders.ts) each did their own raw prisma.order.update() and
// skipped all of it. Concretely, that meant: an order marked COMPLETED via
// KDS never got inventory deducted, loyalty earned, deal counters bumped,
// or Zapier/ERP notified; an order CANCELLED via KDS never got its
// inventory reversed or a cancellation event recorded; and neither path
// invalidated the live-orders cache, so other terminals could keep seeing
// stale data after a KDS action. Unifying on this one function is the fix —
// every order-mutating path now funnels through the same side effects.
export async function applyOrderStatusSideEffects(
  tenantId: string,
  order: any,
  priorStatus: string | null,
  options: { payments?: any[]; redeemedPointsAmount?: number } = {}
) {
  if (order.status === 'CANCELLED' && priorStatus && priorStatus !== 'CANCELLED') {
    reverseOrDiscardInventoryForCancelledOrder(order.id, priorStatus).catch((e: any) => console.error('Inventory Reversal Error:', e));
  }

  if (order.status === 'CANCELLED') {
    emitOrderCancelled(tenantId, order.branchId, order.id);
  } else {
    emitOrderUpdated(tenantId, order.branchId, order);
  }

  if (order.tableId) {
    // Part 3 — the table's status is derived, never set to a literal here.
    // A completed order stamps lastCompletedAt (so the table goes DIRTY and
    // clears to FREE after the cleaning window); a cancel/void just frees it
    // (nobody ate). Fire-and-forget: the order update is already confirmed.
    if (order.status === 'COMPLETED') {
      markTableOrderCompleted(tenantId, order.tableId).catch(() => {});
    } else {
      recomputeTableStatus(tenantId, order.tableId).catch(() => {});
    }
  }

  invalidateLiveOrdersCache(tenantId, order.branchId);

  await enqueueOrderEvents(tenantId, order, options.payments, options.redeemedPointsAmount);
}

export async function assignOrder(tenantId: string, id: string, data: { waiterId: string; waiterName: string }) {
  const updated = await prisma.order.update({
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
  invalidateLiveOrdersCache(tenantId, updated.branchId);
  return updated;
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
    include: { item: true, order: { select: { shiftId: true, orderNumber: true } } }
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

    const recalculated = await prisma.order.update({
      where: { id: orderId },
      data: {
        totalAmount: taxableSubtotal, taxAmount, netAmount: taxableSubtotal + taxAmount,
        cashTaxRate: cashTaxRate / 100, cardTaxRate: cardTaxRate / 100, appliedTaxRate, appliedTaxLabel,
      },
      include: { items: { include: { item: { select: { name: true, image: true } } } }, payments: true, table: true, assignedWaiter: true }
    });
    invalidateLiveOrdersCache(tenantId, order.branchId);
    return recalculated;
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

  // Mirror the void onto the shift timeline. The AuditLog below is the
  // tenant-wide compliance record; this is the same event in the cashier's
  // own shift narrative, which is what the shift PDF and Shift Management
  // timeline read from.
  recordOrderVoided(
    { id: orderId, shiftId: orderItem.order?.shiftId ?? null, orderNumber: orderItem.order?.orderNumber ?? null },
    {
      itemName,
      quantity: data.quantity,
      amount: data.quantity * orderItem.unitPrice,
      reason: data.reason,
      performedById: data.approvedByManagerId ?? cashierId,
    },
  );

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

  invalidateLiveOrdersCache(tenantId, updatedOrder.branchId);

  return updatedOrder;
}
