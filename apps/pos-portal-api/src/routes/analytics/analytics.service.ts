import { prisma } from '@dineiz/pos-portal-db';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getSalesSummary(branchId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const orders = await prisma.order.findMany({
    where: { branchId, status: 'COMPLETED', createdAt: { gte: since } },
    include: { payment: true },
  });

  const revenue30d = orders.reduce((sum, o) => sum + (o.payment?.total ?? 0), 0);
  const orders30d = orders.length;
  const avgOrderValue = orders30d > 0 ? Math.round(revenue30d / orders30d) : 0;

  const byDay = new Map<number, number>();
  for (const o of orders) {
    const day = o.createdAt.getDay();
    byDay.set(day, (byDay.get(day) ?? 0) + (o.payment?.total ?? 0));
  }
  let topDay = 'N/A';
  let topDayRevenue = -1;
  byDay.forEach((revenue, day) => {
    if (revenue > topDayRevenue) {
      topDayRevenue = revenue;
      topDay = DAY_NAMES[day]!;
    }
  });

  return { revenue30d, orders30d, avgOrderValue, topDay };
}

export async function getTopItems(branchId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const items = await prisma.orderItem.findMany({
    where: { order: { branchId, status: 'COMPLETED', createdAt: { gte: since } } },
    select: { nameSnapshot: true, priceSnapshot: true, qty: true },
  });

  const byName = new Map<string, { unitsSold: number; revenue: number }>();
  for (const item of items) {
    const entry = byName.get(item.nameSnapshot) ?? { unitsSold: 0, revenue: 0 };
    entry.unitsSold += item.qty;
    entry.revenue += item.priceSnapshot * item.qty;
    byName.set(item.nameSnapshot, entry);
  }

  const result: { name: string; unitsSold: number; revenue: number }[] = [];
  byName.forEach((stats, name) => result.push({ name, ...stats }));
  return result.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

export async function getStaffPerformance(branchId: string) {
  const orders = await prisma.order.findMany({
    where: { branchId, status: 'COMPLETED', handledById: { not: null } },
    include: { payment: true, handledBy: true },
  });

  const byStaff = new Map<string, { staff: string; ordersHandled: number; totalValue: number }>();
  for (const o of orders) {
    if (!o.handledBy) continue;
    const entry = byStaff.get(o.handledBy.id) ?? { staff: o.handledBy.name, ordersHandled: 0, totalValue: 0 };
    entry.ordersHandled += 1;
    entry.totalValue += o.payment?.total ?? 0;
    byStaff.set(o.handledBy.id, entry);
  }

  const result: { staff: string; ordersHandled: number; avgOrderValue: number }[] = [];
  byStaff.forEach((e) => result.push({ staff: e.staff, ordersHandled: e.ordersHandled, avgOrderValue: Math.round(e.totalValue / e.ordersHandled) }));
  return result.sort((a, b) => b.ordersHandled - a.ordersHandled);
}
