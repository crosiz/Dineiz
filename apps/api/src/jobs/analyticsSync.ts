import { prisma, Prisma } from '@dineiz/db';
import { upstash } from '../lib/redis';
import { toZonedTime, format } from 'date-fns-tz';

export async function runAnalyticsAggregationJob(tenantId: string, branchId: string, date: Date, tz: string = 'Asia/Karachi') {
  // Aggregate stats for the given date boundaries
  // 1. Calculate boundaries (5am to 5am logical day)
  const zonedDate = toZonedTime(date, tz);
  const isBefore5am = zonedDate.getHours() < 5;
  const logicalDate = new Date(zonedDate);
  if (isBefore5am) {
    logicalDate.setDate(logicalDate.getDate() - 1);
  }
  
  const year = logicalDate.getFullYear();
  const month = logicalDate.getMonth();
  const day = logicalDate.getDate();
  
  const startOfDay = new Date(year, month, day, 5, 0, 0, 0); // Local 5am
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const dateStr = format(startOfDay, 'yyyy-MM-dd'); // the logical date string

  console.log(`[AnalyticsJob] Aggregating ${tenantId} / ${branchId} for ${dateStr}`);

  // Fetch all completed orders for this branch/tenant on this logical day
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      branchId,
      status: 'COMPLETED',
      createdAt: {
        gte: startOfDay,
        lt: endOfDay
      }
    },
    include: {
      items: {
        include: {
          item: true
        }
      },
      payments: true,
      shift: {
        include: { user: true }
      },
      customer: true
    }
  });

  // Calculate KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const taxCollected = orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
  const discountGiven = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
  const netRevenue = orders.reduce((sum, o) => sum + (o.netAmount || 0), 0);
  const orderCount = orders.length;

  // Breakdown by Type
  const revenueByType: Record<string, { count: number; value: number }> = {};
  // Breakdown by Payment Method
  const revenueByPayment: Record<string, { count: number; value: number }> = {};
  
  // Heatmap (day of week -> hour of day) -> array of 7 arrays of 24 hours
  const hourlyOrders = Array.from({ length: 7 }, () => new Array(24).fill(0));
  
  // Staff Performance
  const staffMetrics: Record<string, { name: string; role: string; orders: number; revenue: number; discount: number }> = {};

  // Menu Performance
  const itemMetrics: Record<string, { name: string; categoryId: string | null; qty: number; revenue: number }> = {};

  // Customer Analytics
  const customers = new Set();
  let newCustomers = 0;

  for (const o of orders) {
    const type = o.type || 'DINE_IN';
    if (!revenueByType[type]) revenueByType[type] = { count: 0, value: 0 };
    revenueByType[type].count++;
    revenueByType[type].value += o.netAmount || 0;

    for (const p of o.payments) {
      if (!revenueByPayment[p.method]) revenueByPayment[p.method] = { count: 0, value: 0 };
      revenueByPayment[p.method].count++;
      revenueByPayment[p.method].value += p.amount;
    }

    const oHour = toZonedTime(o.createdAt, tz).getHours();
    const oDow = toZonedTime(o.createdAt, tz).getDay(); // 0 (Sun) to 6 (Sat)
    hourlyOrders[oDow][oHour]++;

    if (o.shift?.user) {
      const s = o.shift.user;
      if (!staffMetrics[s.id]) staffMetrics[s.id] = { name: s.name || '', role: s.role, orders: 0, revenue: 0, discount: 0 };
      staffMetrics[s.id].orders++;
      staffMetrics[s.id].revenue += o.netAmount || 0;
      staffMetrics[s.id].discount += o.discountAmount || 0;
    }

    for (const i of o.items) {
      if (!itemMetrics[i.itemId]) {
        itemMetrics[i.itemId] = { name: i.item.name, categoryId: i.item.categoryId, qty: 0, revenue: 0 };
      }
      itemMetrics[i.itemId].qty += i.quantity;
      itemMetrics[i.itemId].revenue += i.subtotal;
    }

    if (o.customerId) {
      if (!customers.has(o.customerId)) {
        customers.add(o.customerId);
        // Note: New vs Returning ideally needs a historical check, but we can do a simplified one or 
        // rely on a separate query. For now, we'll just track unique daily customers here.
      }
    }
  }

  // Construct payload
  const payload = {
    date: dateStr,
    kpis: { totalRevenue, orderCount, taxCollected, discountGiven, netRevenue },
    breakdowns: { type: revenueByType, payment: revenueByPayment },
    hourly: hourlyOrders,
    staff: Object.values(staffMetrics),
    items: Object.values(itemMetrics),
    customers: { unique: customers.size }
  };

  const key = `analytics:${tenantId}:${branchId}:${dateStr}`;
  
  // Decide TTL
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24));
  
  let ttl = 60 * 5; // 5 mins default for today
  if (diffDays >= 1 && diffDays <= 7) {
    ttl = 60 * 60; // 1 hour for recent days
  } else if (diffDays > 7) {
    ttl = 60 * 60 * 24 * 30; // 30 days for older
  }

  // Uses Upstash's REST client (stateless HTTPS per call) rather than a
  // persistent TCP connection — see lib/redis.ts / auth.ts for why that
  // matters here. Still wrapped: this is a cache write for an
  // already-computed, always-recomputable payload, so a hiccup shouldn't
  // fail the whole aggregation.
  try {
    await upstash.set(key, payload, { ex: ttl });
  } catch (err: any) {
    console.error(`[AnalyticsJob] Failed to cache ${key}:`, err.message || err);
  }

  return payload;
}
