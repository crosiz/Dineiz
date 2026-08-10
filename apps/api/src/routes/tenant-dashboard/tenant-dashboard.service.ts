import { prisma } from '@dineiz/db';

export async function getDashboardSummary(tenantId: string, branchId?: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let todayData, yesterdayData, activeData, branchesData;

  if (branchId) {
    todayData = await prisma.$queryRaw`SELECT COUNT(*)::int as orders, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND "branchId" = ${branchId} AND date_trunc('day', "createdAt") = ${todayStr}::date`;
    yesterdayData = await prisma.$queryRaw`SELECT COUNT(*)::int as orders, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND "branchId" = ${branchId} AND date_trunc('day', "createdAt") = ${yesterdayStr}::date`;
    activeData = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "Order" WHERE "tenantId" = ${tenantId} AND "branchId" = ${branchId} AND "status" IN ('PENDING', 'IN_KITCHEN', 'READY')`;
    branchesData = await prisma.$queryRaw`SELECT COUNT(DISTINCT "branchId")::int as count FROM "Shift" WHERE "status" = 'OPEN' AND "branchId" = ${branchId}`;
  } else {
    todayData = await prisma.$queryRaw`SELECT COUNT(*)::int as orders, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND date_trunc('day', "createdAt") = ${todayStr}::date`;
    yesterdayData = await prisma.$queryRaw`SELECT COUNT(*)::int as orders, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND date_trunc('day', "createdAt") = ${yesterdayStr}::date`;
    activeData = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "Order" WHERE "tenantId" = ${tenantId} AND "status" IN ('PENDING', 'IN_KITCHEN', 'READY')`;
    branchesData = await prisma.$queryRaw`SELECT COUNT(DISTINCT "branchId")::int as count FROM "Shift" WHERE "status" = 'OPEN' AND "branchId" IN (SELECT "id" FROM "Branch" WHERE "tenantId" = ${tenantId})`;
  }

  const staffOnlineData: Array<{ count: number }> = await prisma.$queryRaw`SELECT COUNT(DISTINCT s."userId")::int as count FROM "Session" s JOIN "User" u ON s."userId" = u."id" WHERE u."tenantId" = ${tenantId} AND s."expiresAt" > now()`;

  const t = (todayData as any[])[0] || { orders: 0, revenue: 0 };
  const y = (yesterdayData as any[])[0] || { orders: 0, revenue: 0 };
  return {
    revenue: t.revenue,
    revenueChange: y.revenue > 0 ? ((t.revenue - y.revenue) / y.revenue) * 100 : 0,
    orders: t.orders,
    ordersChange: y.orders > 0 ? ((t.orders - y.orders) / y.orders) * 100 : 0,
    averageOrderValue: t.orders > 0 ? t.revenue / t.orders : 0,
    activeOrders: Number((activeData as any[])[0]?.count) || 0,
    activeBranches: Number((branchesData as any[])[0]?.count) || 0,
    activeStaff: Number(staffOnlineData[0]?.count) || 0,
  };
}

export async function getRevenueTrend(tenantId: string, days: number, branchId?: string) {
  if (branchId) {
    return prisma.$queryRaw<Array<{ date: string; revenue: number }>>`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as date, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND "branchId" = ${branchId} AND "createdAt" >= now() - (${days}::int || ' days')::interval GROUP BY 1 ORDER BY 1 ASC;`;
  }
  return prisma.$queryRaw<Array<{ date: string; revenue: number }>>`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as date, COALESCE(SUM("netAmount"), 0)::float as revenue FROM "Order" WHERE "tenantId" = ${tenantId} AND "createdAt" >= now() - (${days}::int || ' days')::interval GROUP BY 1 ORDER BY 1 ASC;`;
}

export async function getTopBranches(tenantId: string, branchId?: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (branchId) {
    return prisma.$queryRaw`SELECT b."name" as "branchName", COUNT(DISTINCT o."id")::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue, EXISTS(SELECT 1 FROM "Shift" s WHERE s."branchId" = b."id" AND s."status" = 'OPEN') as open FROM "Branch" b LEFT JOIN "Order" o ON o."branchId" = b."id" AND date_trunc('day', o."createdAt") = ${todayStr}::date WHERE b."tenantId" = ${tenantId} AND b."id" = ${branchId} GROUP BY b."id", b."name" ORDER BY revenue DESC LIMIT 5;`;
  }
  return prisma.$queryRaw`SELECT b."name" as "branchName", COUNT(DISTINCT o."id")::int as orders, COALESCE(SUM(o."netAmount"), 0)::float as revenue, EXISTS(SELECT 1 FROM "Shift" s WHERE s."branchId" = b."id" AND s."status" = 'OPEN') as open FROM "Branch" b LEFT JOIN "Order" o ON o."branchId" = b."id" AND date_trunc('day', o."createdAt") = ${todayStr}::date WHERE b."tenantId" = ${tenantId} GROUP BY b."id", b."name" ORDER BY revenue DESC LIMIT 5;`;
}

export async function getTopItems(tenantId: string, branchId?: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (branchId) {
    return prisma.$queryRaw`SELECT i."name" as name, COALESCE(SUM(oi."quantity"), 0)::int as quantity, COALESCE(SUM(oi."subtotal"), 0)::float as revenue FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Item" i ON i."id" = oi."itemId" WHERE o."tenantId" = ${tenantId} AND o."branchId" = ${branchId} AND date_trunc('day', o."createdAt") = ${todayStr}::date GROUP BY 1 ORDER BY revenue DESC LIMIT 5;`;
  }
  return prisma.$queryRaw`SELECT i."name" as name, COALESCE(SUM(oi."quantity"), 0)::int as quantity, COALESCE(SUM(oi."subtotal"), 0)::float as revenue FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Item" i ON i."id" = oi."itemId" WHERE o."tenantId" = ${tenantId} AND date_trunc('day', o."createdAt") = ${todayStr}::date GROUP BY 1 ORDER BY revenue DESC LIMIT 5;`;
}

export async function getTenantAlerts(tenantId: string) {
  return prisma.$queryRaw<Array<{ itemName: string; quantity: number; reorderLevel: number }>>`SELECT ing."name" as "itemName", s."quantity", s."reorderLevel" FROM "Stock" s JOIN "Ingredient" ing ON ing."id" = s."ingredientId" WHERE s."tenantId" = ${tenantId} AND s."quantity" <= s."reorderLevel" LIMIT 10;`;
}

export async function getRecentOrders(tenantId: string, limit: number) {
  return prisma.order.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit, include: { items: true } });
}
