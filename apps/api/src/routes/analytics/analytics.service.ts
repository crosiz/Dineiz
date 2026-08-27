import { prisma, Prisma } from '@dineiz/db';
import { upstash } from '../../lib/redis';
import { cached } from '../../lib/cache';
import { runAnalyticsAggregationJob } from '../../jobs/analyticsSync';
import { format, addDays, differenceInDays } from 'date-fns';

function getDayBoundaries() {
  const now = new Date();
  const logicalNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const todayStart = new Date(logicalNow.getFullYear(), logicalNow.getMonth(), logicalNow.getDate());
  todayStart.setHours(5, 0, 0, 0);
  
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  return { todayStart, tomorrowStart, yesterdayStart };
}

export async function getDailySales(tenantId: string, days: number, branchId?: string) {
  return prisma.$queryRaw<Array<{ day: string; orders: number; gross: number; discount: number; tax: number; net: number }>>`
    SELECT to_char(date_trunc('day', COALESCE(s."openedAt", o."createdAt") - interval '5 hours'), 'YYYY-MM-DD') as day,
      COUNT(*)::int as orders,
      COALESCE(SUM(o."totalAmount"), 0)::float as gross,
      COALESCE(SUM(o."discountAmount"), 0)::float as discount,
      COALESCE(SUM(o."taxAmount"), 0)::float as tax,
      COALESCE(SUM(o."netAmount"), 0)::float as net
    FROM "Order" o
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND COALESCE(s."openedAt", o."createdAt") >= now() - (${days}::int || ' days')::interval
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1 ASC;
  `;
}

export async function getHourlyHeatmap(tenantId: string, days: number, branchId?: string) {
  return prisma.$queryRaw<Array<{ dow: number; hour: number; orders: number; net: number }>>`
    SELECT EXTRACT(DOW FROM COALESCE(s."openedAt", o."createdAt"))::int as dow,
      EXTRACT(HOUR FROM COALESCE(s."openedAt", o."createdAt"))::int as hour,
      COUNT(*)::int as orders,
      COALESCE(SUM(o."netAmount"), 0)::float as net
    FROM "Order" o
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND COALESCE(s."openedAt", o."createdAt") >= now() - (${days}::int || ' days')::interval
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1,2 ORDER BY 1 ASC, 2 ASC;
  `;
}

export async function getItemPerformance(tenantId: string, days: number, limit: number, branchId?: string) {
  return prisma.$queryRaw<Array<{ itemId: string; name: string; qty: number; revenue: number }>>`
    SELECT oi."itemId" as "itemId", i."name" as name,
      COALESCE(SUM(oi."quantity"), 0)::int as qty,
      COALESCE(SUM(oi."subtotal"), 0)::float as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    JOIN "Item" i ON i."id" = oi."itemId"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND COALESCE(s."openedAt", o."createdAt") >= now() - (${days}::int || ' days')::interval
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1,2 ORDER BY revenue DESC LIMIT ${limit};
  `;
}

export async function getTodayKpis(tenantId: string, branchId?: string, shiftId?: string) {
  if (shiftId) {
    const rawBranchFilter = branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty;
    const data = await prisma.$queryRaw<Array<{ orders: number; revenue: number }>>`
      SELECT COUNT(*)::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue
      FROM "Order" o
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'
        AND o."shiftId" = ${shiftId}
        ${rawBranchFilter}
    `;
    const t = data[0] || { orders: 0, revenue: 0 };
    return {
      revenue: t.revenue,
      revenueChange: 0,
      orders: t.orders,
      ordersChange: 0,
      averageOrderValue: t.orders > 0 ? t.revenue / t.orders : 0,
      activeOrders: 0,
    };
  }

  const { todayStart, tomorrowStart, yesterdayStart } = getDayBoundaries();

  const [todayData, yesterdayData, activeData] = await Promise.all([
    prisma.$queryRaw<Array<{ orders: number; revenue: number }>>`
      SELECT COUNT(*)::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'
        AND COALESCE(s."openedAt", o."createdAt") >= ${todayStart}
        AND COALESCE(s."openedAt", o."createdAt") < ${tomorrowStart}
        ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    `,
    prisma.$queryRaw<Array<{ orders: number; revenue: number }>>`
      SELECT COUNT(*)::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'
        AND COALESCE(s."openedAt", o."createdAt") >= ${yesterdayStart}
        AND COALESCE(s."openedAt", o."createdAt") < ${todayStart}
        ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count 
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId} AND o."status" IN ('PENDING', 'IN_KITCHEN', 'READY')
        AND COALESCE(s."openedAt", o."createdAt") >= ${todayStart}
        ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    `,
  ]);

  const t = todayData[0] || { orders: 0, revenue: 0 };
  const y = yesterdayData[0] || { orders: 0, revenue: 0 };
  return {
    revenue: t.revenue,
    revenueChange: y.revenue > 0 ? ((t.revenue - y.revenue) / y.revenue) * 100 : 0,
    orders: t.orders,
    ordersChange: y.orders > 0 ? ((t.orders - y.orders) / y.orders) * 100 : 0,
    averageOrderValue: t.orders > 0 ? t.revenue / t.orders : 0,
    activeOrders: activeData[0]?.count || 0,
  };
}

export async function getRevenueChart(tenantId: string, days: number, branchId?: string) {
  return prisma.$queryRaw<Array<{ date: string; revenue: number }>>`
    SELECT to_char(date_trunc('day', COALESCE(s."openedAt", o."createdAt") - interval '5 hours'), 'YYYY-MM-DD') as date,
      COALESCE(SUM(o."netAmount"), 0)::float as revenue
    FROM "Order" o
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND COALESCE(s."openedAt", o."createdAt") >= now() - (${days}::int || ' days')::interval
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1 ASC;
  `;
}

export async function getTopItems(tenantId: string, date: string, branchId?: string) {
  const targetDate = date === 'today' ? new Date().toISOString().split('T')[0] : date;
  return prisma.$queryRaw<Array<{ name: string; quantity: number; revenue: number }>>`
    SELECT i."name" as name,
      COALESCE(SUM(oi."quantity"), 0)::int as quantity,
      COALESCE(SUM(oi."subtotal"), 0)::float as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    JOIN "Item" i ON i."id" = oi."itemId"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND date_trunc('day', COALESCE(s."openedAt", o."createdAt") - interval '5 hours') = ${targetDate}::date
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1 ORDER BY revenue DESC LIMIT 5;
  `;
}

export async function getBranchPerformance(tenantId: string, scopedBranchId?: string) {
  const { todayStart, tomorrowStart } = getDayBoundaries();
  return prisma.$queryRaw<Array<{ branchName: string; orders: number; revenue: number; open: boolean }>>`
    SELECT b."name" as "branchName",
      COUNT(DISTINCT o."id")::int as orders,
      COALESCE(SUM(o."netAmount"), 0)::float as revenue,
      EXISTS(SELECT 1 FROM "Shift" s WHERE s."branchId" = b."id" AND s."status" = 'OPEN') as open
    FROM "Branch" b
    LEFT JOIN "Order" o ON o."branchId" = b."id" 
      AND o."status" = 'COMPLETED'
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE b."tenantId" = ${tenantId}
      AND (o."id" IS NULL OR (COALESCE(s."openedAt", o."createdAt") >= ${todayStart} AND COALESCE(s."openedAt", o."createdAt") < ${tomorrowStart}))
      ${scopedBranchId ? Prisma.sql`AND b."id" = ${scopedBranchId}` : Prisma.empty}
    GROUP BY b."id", b."name" ORDER BY revenue DESC;
  `;
}

// The dashboard home hits this on every visit and polls it every 60s; the
// client already treats it as up-to-30s stale. A short server cache absorbs
// the burst (login + tab returns) without the widget ever being visibly behind.
export async function getDashboardSummary(tenantId: string, branchId?: string, period: string = 'today') {
  return cached(
    `dash:summary:${tenantId}:${branchId ?? 'all'}:${period}`,
    15,
    () => computeDashboardSummary(tenantId, branchId, period),
  );
}

async function computeDashboardSummary(tenantId: string, branchId?: string, period: string = 'today') {
  const days = period === '30d' ? 30 : period === '7d' ? 7 : 1;
  const { todayStart, tomorrowStart, yesterdayStart } = getDayBoundaries();
  const todayStr = todayStart.toISOString().split('T')[0];

  const rawBranchFilter = branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty;
  const rawShiftBranchFilter = branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty;
  const prismaBranchFilter = branchId ? { branchId } : {};

  // 1. Today vs Yesterday KPIs
  const [todayData, yesterdayData, activeData, carriedOverRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ orders: number; revenue: number }>>`
      SELECT COUNT(*)::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'
        AND COALESCE(s."openedAt", o."createdAt") >= ${todayStart}
        AND COALESCE(s."openedAt", o."createdAt") < ${tomorrowStart}
        ${rawBranchFilter}
    `,
    prisma.$queryRaw<Array<{ orders: number; revenue: number }>>`
      SELECT COUNT(*)::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'
        AND COALESCE(s."openedAt", o."createdAt") >= ${yesterdayStart}
        AND COALESCE(s."openedAt", o."createdAt") < ${todayStart}
        ${rawBranchFilter}
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int as count 
      FROM "Order" o
      LEFT JOIN "Shift" s ON o."shiftId" = s."id"
      WHERE o."tenantId" = ${tenantId} 
        AND o."status" IN ('PENDING', 'IN_KITCHEN', 'READY')
        AND COALESCE(s."openedAt", o."createdAt") >= ${todayStart}
        ${rawBranchFilter}
    `,
    // Carried over shifts
    prisma.$queryRaw<Array<{ count: number; pendingReconciliation: number }>>`
      SELECT 
        COUNT(DISTINCT s."id")::int as count, 
        COALESCE(SUM(o."netAmount"), 0)::float as "pendingReconciliation"
      FROM "Shift" s
      LEFT JOIN "Order" o ON o."shiftId" = s."id" AND o."status" = 'COMPLETED'
      WHERE s."tenantId" = ${tenantId}
        AND s."status" = 'OPEN'
        AND s."openedAt" < ${todayStart}
        ${rawShiftBranchFilter}
    `
  ]);

  const t = todayData[0] || { orders: 0, revenue: 0 };
  const y = yesterdayData[0] || { orders: 0, revenue: 0 };
  const carriedOver = carriedOverRaw[0] || { count: 0, pendingReconciliation: 0 };

  const revenueChange = y.revenue > 0 ? ((t.revenue - y.revenue) / y.revenue) * 100 : 0;
  const ordersChange = y.orders > 0 ? ((t.orders - y.orders) / y.orders) * 100 : 0;
  const avgOrderValueToday = t.orders > 0 ? t.revenue / t.orders : 0;
  const avgOrderValueYesterday = y.orders > 0 ? y.revenue / y.orders : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (avgOrderValueToday > avgOrderValueYesterday * 1.05) trend = 'up';
  else if (avgOrderValueToday < avgOrderValueYesterday * 0.95) trend = 'down';

  // 2. Inventory Health
  const outOfStockCount = await prisma.stock.count({
    where: { tenantId, quantity: { lte: 0 }, ...prismaBranchFilter }
  });
  const lowStockCount = await prisma.stock.count({
    where: { tenantId, quantity: { gt: 0 }, ...prismaBranchFilter, AND: [{ quantity: { lte: prisma.stock.fields.reorderLevel } }] }
  });

  let inventoryStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  let inventoryMessage = 'Inventory Healthy';
  if (outOfStockCount > 0) {
    inventoryStatus = 'critical';
    inventoryMessage = `${outOfStockCount} items out of stock`;
  } else if (lowStockCount > 0) {
    inventoryStatus = 'warning';
    inventoryMessage = `${lowStockCount} items low on stock`;
  }

  // 3. Recent Orders — scoped to today, matching every other card on this
  // "Today" dashboard. A quiet start to the day means an honest empty
  // state here, not yesterday's (or last week's) orders standing in.
  const recentOrdersRaw = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: todayStart, lt: tomorrowStart }, ...prismaBranchFilter },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      orderNumber: true,
      type: true,
      netAmount: true,
      status: true,
      createdAt: true,
      branch: { select: { name: true } }
    }
  });

  // 4. Top Selling Items
  const targetDateFilter = period === 'today'
    ? Prisma.sql`AND COALESCE(s."openedAt", o."createdAt") >= ${todayStart} AND COALESCE(s."openedAt", o."createdAt") < ${tomorrowStart}`
    : Prisma.sql`AND COALESCE(s."openedAt", o."createdAt") >= now() - (${days}::int || ' days')::interval`;

  const topItemsRaw = await prisma.$queryRaw<Array<{ name: string; quantity: number; revenue: number }>>`
    SELECT i."name" as name,
      COALESCE(SUM(oi."quantity"), 0)::int as quantity,
      COALESCE(SUM(oi."subtotal"), 0)::float as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    JOIN "Item" i ON i."id" = oi."itemId"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      ${targetDateFilter}
      ${rawBranchFilter}
    GROUP BY 1 ORDER BY revenue DESC LIMIT 5;
  `;

  // 5. Branch Performance
  const branchesRaw = await prisma.$queryRaw<Array<{ id: string; branchName: string; orders: number; revenue: number; open: boolean }>>`
    SELECT b."id" as id, b."name" as "branchName",
      COUNT(DISTINCT o."id")::int as orders,
      COALESCE(SUM(o."netAmount"), 0)::float as revenue,
      EXISTS(SELECT 1 FROM "Shift" s WHERE s."branchId" = b."id" AND s."status" = 'OPEN') as open
    FROM "Branch" b
    LEFT JOIN "Order" o ON o."branchId" = b."id" AND o."status" = 'COMPLETED'
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE b."tenantId" = ${tenantId}
      AND (o."id" IS NULL OR (COALESCE(s."openedAt", o."createdAt") >= ${todayStart} AND COALESCE(s."openedAt", o."createdAt") < ${tomorrowStart}))
      ${branchId ? Prisma.sql`AND b."id" = ${branchId}` : Prisma.empty}
    GROUP BY b."id", b."name" ORDER BY revenue DESC;
  `;

  return {
    revenue: { today: t.revenue, yesterdayChange: revenueChange },
    totalOrders: { today: t.orders, yesterdayChange: ordersChange },
    avgOrderValue: { today: avgOrderValueToday, trend },
    activeOrders: { count: activeData[0]?.count || 0 },
    carriedOver: { count: carriedOver.count, pendingReconciliation: carriedOver.pendingReconciliation },
    inventoryHealth: {
      status: inventoryStatus,
      lowStockCount,
      outOfStockCount,
      message: inventoryMessage
    },
    recentOrders: recentOrdersRaw.map(r => ({
      id: r.id,
      orderNumber: r.orderNumber,
      type: r.type,
      total: r.netAmount,
      status: r.status,
      createdAt: r.createdAt,
      branchName: r.branch?.name || ''
    })),
    topSellingItems: topItemsRaw.map((item, index) => ({
      name: item.name,
      qtySold: item.quantity,
      revenue: item.revenue,
      rank: index + 1
    })),
    branchPerformance: branchesRaw.map(b => ({
      id: b.id,
      name: b.branchName,
      ordersToday: b.orders,
      revenueToday: b.revenue,
      isOpen: b.open
    }))
  };
}

export async function getRevenueTrend(tenantId: string, branchId?: string, period: string = 'today') {
  return cached(
    `dash:revtrend:${tenantId}:${branchId ?? 'all'}:${period}`,
    30,
    () => computeRevenueTrend(tenantId, branchId, period),
  );
}

async function computeRevenueTrend(tenantId: string, branchId?: string, period: string = 'today') {
  const days = period === '30d' ? 30 : period === '7d' ? 7 : 1;
  const trendDays = period === 'today' ? 7 : days;

  const data = await prisma.$queryRaw<Array<{ date: string; revenue: number; orders: number }>>`
    SELECT to_char(date_trunc('day', COALESCE(s."openedAt", o."createdAt") - interval '5 hours'), 'YYYY-MM-DD') as date,
      COALESCE(SUM(o."netAmount"), 0)::float as revenue,
      COUNT(*)::int as orders
    FROM "Order" o
    LEFT JOIN "Shift" s ON o."shiftId" = s."id"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = 'COMPLETED'
      AND COALESCE(s."openedAt", o."createdAt") >= now() - (${trendDays}::int || ' days')::interval
      ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1 ASC;
  `;

  return data.map(r => ({
    date: new Date(r.date).toLocaleDateString('en', { weekday: 'short' }),
    revenue: r.revenue,
    orders: r.orders
  }));
}

export async function getDashboardAnalytics(tenantId: string, branchId: string | undefined, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = differenceInDays(end, start);
  
  if (diff < 0 || diff > 90) throw new Error('Invalid date range or exceeding 90 days');

  const branches = branchId ? [branchId] : await prisma.branch.findMany({ where: { tenantId } }).then(res => res.map(r => r.id));
  
  const datesToFetch: string[] = [];
  for(let i = 0; i <= diff; i++) {
    datesToFetch.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }

  // Fetch from redis
  const keys: string[] = [];
  for(const b of branches) {
    for(const d of datesToFetch) {
      keys.push(`analytics:${tenantId}:${b}:${d}`);
    }
  }

  // Uses Upstash's REST client (stateless HTTPS per call, values come back
  // already JSON-parsed) rather than a persistent TCP connection — see
  // lib/redis.ts / auth.ts for why. Still a read-through cache backed by
  // Postgres, so a hiccup here should degrade to "recompute everything",
  // not fail the whole request.
  const safeMget = async (ks: string[]): Promise<(any | null)[]> => {
    try {
      return await upstash.mget(...ks);
    } catch (err: any) {
      console.error('[Analytics] Redis mget failed, recomputing from DB:', err.message || err);
      return new Array(ks.length).fill(null);
    }
  };

  let cached = await safeMget(keys);

  // Find misses and compute. Keep the freshly-computed payload in memory too
  // (keyed by cache key) in case the cache write itself also fails — we
  // shouldn't lose data we just calculated because Redis is unhappy.
  const freshlyComputed = new Map<string, any>();
  for (let i = 0; i < keys.length; i++) {
    if (!cached[i]) {
      const parts = keys[i].split(':');
      const bId = parts[2];
      const dStr = parts[3];
      // Compute inline
      const payload = await runAnalyticsAggregationJob(tenantId, bId, new Date(dStr + 'T12:00:00Z'));
      freshlyComputed.set(keys[i], payload);
    }
  }

  // Re-fetch to guarantee we have all
  cached = await safeMget(keys);

  // Merge payloads
  const result = {
    kpis: { totalRevenue: 0, orderCount: 0, taxCollected: 0, discountGiven: 0, netRevenue: 0 },
    breakdowns: { type: {} as any, payment: {} as any },
    hourly: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    staff: {} as any,
    items: {} as any,
    customers: { unique: 0 },
    dailyTrend: [] as any[], // revenue, orders per day
    branchComparison: {} as any
  };

  const dailyMap: any = {};

  for (let i = 0; i < keys.length; i++) {
    const payload = cached[i] ?? freshlyComputed.get(keys[i]);
    if (!payload) continue;
    const parts = keys[i].split(':');
    const bId = parts[2];
    const dStr = parts[3];

    // Branch comparison tracking
    if (!result.branchComparison[bId]) result.branchComparison[bId] = { revenue: 0, orders: 0 };
    result.branchComparison[bId].revenue += payload.kpis.netRevenue;
    result.branchComparison[bId].orders += payload.kpis.orderCount;

    // Daily Trend tracking
    if (!dailyMap[dStr]) dailyMap[dStr] = { date: dStr, revenue: 0, orders: 0 };
    dailyMap[dStr].revenue += payload.kpis.netRevenue;
    dailyMap[dStr].orders += payload.kpis.orderCount;

    // Sum KPIs
    result.kpis.totalRevenue += payload.kpis.totalRevenue;
    result.kpis.orderCount += payload.kpis.orderCount;
    result.kpis.taxCollected += payload.kpis.taxCollected;
    result.kpis.discountGiven += payload.kpis.discountGiven;
    result.kpis.netRevenue += payload.kpis.netRevenue;

    // Sum Breakdowns
    for (const [k, v] of Object.entries(payload.breakdowns.type) as any) {
      if(!result.breakdowns.type[k]) result.breakdowns.type[k] = { count: 0, value: 0 };
      result.breakdowns.type[k].count += v.count;
      result.breakdowns.type[k].value += v.value;
    }
    for (const [k, v] of Object.entries(payload.breakdowns.payment) as any) {
      if(!result.breakdowns.payment[k]) result.breakdowns.payment[k] = { count: 0, value: 0 };
      result.breakdowns.payment[k].count += v.count;
      result.breakdowns.payment[k].value += v.value;
    }

    // Sum Hourly
    for(let d=0; d<7; d++) {
      for(let h=0; h<24; h++) {
        result.hourly[d][h] += payload.hourly[d][h];
      }
    }

    // Sum Staff
    for(const s of payload.staff) {
      if(!result.staff[s.name]) result.staff[s.name] = { name: s.name, role: s.role, orders: 0, revenue: 0, discount: 0 };
      result.staff[s.name].orders += s.orders;
      result.staff[s.name].revenue += s.revenue;
      result.staff[s.name].discount += s.discount;
    }

    // Sum Items
    for(const item of payload.items) {
      if(!result.items[item.name]) result.items[item.name] = { name: item.name, categoryId: item.categoryId, qty: 0, revenue: 0 };
      result.items[item.name].qty += item.qty;
      result.items[item.name].revenue += item.revenue;
    }
    
    // Customers (rough unique sum across days for now)
    result.customers.unique += payload.customers.unique;
  }
  result.dailyTrend = Object.values(dailyMap).sort((a:any, b:any) => a.date.localeCompare(b.date));
  result.staff = Object.values(result.staff);
  result.items = Object.values(result.items).sort((a:any, b:any) => b.revenue - a.revenue);
  result.branchComparison = Object.values(result.branchComparison);

  return result;
}



export async function getAnalyticsSummary(tenantId: string, branchId: string | undefined, from: string, to: string) {
  const where = {
    tenantId,
    ...(branchId ? { branchId } : {}),
    status: 'COMPLETED' as const,
    createdAt: { gte: new Date(from), lte: new Date(to) }
  };

  const prevFromStr = new Date(new Date(from).getTime() - (new Date(to).getTime() - new Date(from).getTime())).toISOString();
  const prevToStr = from;

  const [current, previous, byType, byMethod] = await Promise.all([
    prisma.order.aggregate({ where, _count: true, _sum: { netAmount: true, taxAmount: true, discountAmount: true } }),
    prisma.order.aggregate({ where: { ...where, createdAt: { gte: new Date(prevFromStr), lte: new Date(prevToStr) } }, _sum: { netAmount: true } }),
    prisma.order.groupBy({ by: ['type'], where, _count: true, _sum: { netAmount: true } }),
    prisma.payment.groupBy({ by: ['method'], where: { order: { ...where } }, _count: true, _sum: { amount: true } }),
  ]);

  const revenue = current._sum.netAmount ?? 0;
  const prevRevenue = previous._sum.netAmount ?? 0;

  return {
    revenue: Math.round(revenue),
    orders: current._count,
    avgOrderValue: current._count > 0 ? Math.round(revenue / current._count) : 0,
    taxCollected: Math.round(current._sum.taxAmount ?? 0),
    discountsGiven: Math.round(current._sum.discountAmount ?? 0),
    revenueGrowth: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
    byType,
    byMethod
  };
}