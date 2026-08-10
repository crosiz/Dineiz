import { prisma } from '@dineiz/db';
import { redis } from '../../lib/redis';
import { format, subDays, startOfDay, getHours, getDay } from 'date-fns';

const FORECAST_SERVICE_URL = process.env.FORECAST_SERVICE_URL || 'http://localhost:8090';
const TTL = 6 * 60 * 60; // 6 hours

// Helper to call python service
async function callPythonForecast(history: { ds: string; y: number }[], horizonDays: number = 30) {
  if (history.length < 14) return null; // Require 14 days minimum

  try {
    const response = await fetch(`${FORECAST_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, horizon_days: horizonDays, seasonality_mode: 'additive' })
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Forecast service call failed:', err);
    return null;
  }
}

export async function generateRevenueForecast(tenantId: string, branchId?: string) {
  const cacheKey = `forecast:revenue:${tenantId}:${branchId || 'ALL'}`;
  
  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Get past 90 days of daily revenue
  const since = subDays(startOfDay(new Date()), 90);
  
  const orders = await prisma.order.groupBy({
    by: ['createdAt'],
    _sum: { totalAmount: true },
    where: {
      tenantId,
      ...(branchId && { branchId }),
      createdAt: { gte: since },
      status: 'COMPLETED'
    },
    orderBy: { createdAt: 'asc' }
  });

  // Aggregate by date (YYYY-MM-DD)
  const dailyData: Record<string, number> = {};
  for (const o of orders) {
    const ds = format(o.createdAt, 'yyyy-MM-dd');
    dailyData[ds] = (dailyData[ds] || 0) + (o._sum.totalAmount || 0);
  }

  const history = Object.entries(dailyData).map(([ds, y]) => ({ ds, y }));
  if (history.length < 14) {
    const res = { error: 'NOT_ENOUGH_DATA', daysAvailable: history.length, daysRequired: 14 };
    await redis.setex(cacheKey, TTL, JSON.stringify(res));
    return res;
  }

  const forecast = await callPythonForecast(history, 30);
  let predictions = forecast?.forecast || [];

  if (predictions.length === 0) {
    console.log("Python forecast failed, generating fallback seasonal predictions");
    // Generate a simple moving average with day-of-week seasonality
    const byDayOfWeek: Record<number, number[]> = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
    for (const h of history) {
      const day = getDay(new Date(h.ds));
      byDayOfWeek[day].push(h.y);
    }
    
    // Averages per day of week
    const avgByDay: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      if (byDayOfWeek[i].length > 0) {
        avgByDay[i] = byDayOfWeek[i].reduce((a,b)=>a+b, 0) / byDayOfWeek[i].length;
      } else {
        avgByDay[i] = 1000; // fallback
      }
    }

    const lastDate = new Date(history[history.length-1].ds);
    for (let i = 1; i <= 30; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const ds = format(d, 'yyyy-MM-dd');
      const day = getDay(d);
      const yhat = avgByDay[day] * (1 + (Math.random() * 0.1 - 0.05)); // Add slight noise
      predictions.push({ ds, yhat, yhat_lower: yhat * 0.8, yhat_upper: yhat * 1.2 });
    }
  }
  
  const result = {
    actuals: history,
    predictions,
    generatedAt: new Date().toISOString()
  };

  await redis.setex(cacheKey, TTL, JSON.stringify(result));
  return result;
}

export async function generateBusyPeriods(tenantId: string, branchId?: string) {
  const cacheKey = `forecast:busy:${tenantId}:${branchId || 'ALL'}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // For busy periods, we use rolling historical average by day-of-week and hour (past 30 days)
  const since = subDays(new Date(), 30);
  
  const orders = await prisma.order.findMany({
    select: { createdAt: true },
    where: {
      tenantId,
      ...(branchId && { branchId }),
      createdAt: { gte: since },
      status: 'COMPLETED'
    }
  });

  if (orders.length < 50) {
    const res = { error: 'NOT_ENOUGH_DATA' };
    await redis.setex(cacheKey, TTL, JSON.stringify(res));
    return res;
  }

  const grid: Record<string, Record<string, number>> = {}; // dayOfWeek -> hour -> count
  for (let d = 0; d < 7; d++) {
    grid[d] = {};
    for (let h = 0; h < 24; h++) grid[d][h] = 0;
  }

  for (const o of orders) {
    const day = getDay(o.createdAt);
    const hour = getHours(o.createdAt);
    grid[day][hour]++;
  }

  // Calculate averages per hour (over ~4 occurrences of each day in 30 days)
  const numWeeks = 30 / 7;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid[d][h] = Math.round(grid[d][h] / numWeeks);
    }
  }

  const result = { grid, generatedAt: new Date().toISOString() };
  await redis.setex(cacheKey, TTL, JSON.stringify(result));
  return result;
}

export async function generateItemsForecast(tenantId: string, branchId?: string) {
  const cacheKey = `forecast:items:${tenantId}:${branchId || 'ALL'}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // For items, find top 10 items in last 30 days, then use simple moving average for next 7 days
  // (We could use Prophet for each item, but SMA is safer and faster for item-level without high variability)
  const since = subDays(new Date(), 30);
  
  const items = await prisma.orderItem.groupBy({
    by: ['itemId'],
    _sum: { quantity: true },
    where: {
      order: { tenantId, ...(branchId && { branchId }), status: 'COMPLETED', createdAt: { gte: since } }
    },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10
  });

  const nextWeekPredictions = [];

  for (const it of items) {
    const menuItem = await prisma.item.findUnique({ where: { id: it.itemId! } });
    if (!menuItem) continue;

    // Avg qty per week over last 30 days
    const totalQty = it._sum.quantity || 0;
    const weeklyAvg = Math.round((totalQty / 30) * 7);

    nextWeekPredictions.push({
      item: menuItem,
      predictedQuantity: weeklyAvg
    });
  }

  const result = { items: nextWeekPredictions, generatedAt: new Date().toISOString() };
  await redis.setex(cacheKey, TTL, JSON.stringify(result));
  return result;
}

export async function generateInventoryForecast(tenantId: string, branchId?: string) {
  const cacheKey = `forecast:inventory:${tenantId}:${branchId || 'ALL'}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const itemsRes = await generateItemsForecast(tenantId, branchId);
  if (itemsRes.error || !itemsRes.items) return itemsRes;

  const inventoryNeeds: Record<string, {
    ingredientId: string;
    ingredientName: string;
    currentStock: number;
    projectedUsage: number;
    stockAfter: number;
    daysUntilStockout: number | null;
  }> = {};

  // For each predicted item, check recipes
  for (const prediction of itemsRes.items) {
    const recipe = await prisma.recipe.findFirst({
      where: { itemId: prediction.item.id },
      include: { lines: { include: { ingredient: { include: { stock: true } } } } }
    });

    if (recipe) {
      for (const line of recipe.lines) {
        const usage = line.quantity * prediction.predictedQuantity;
        const ing = line.ingredient;
        
        let stock = 0;
        if (branchId) {
          stock = ing.stock.find((s: any) => s.branchId === branchId)?.quantity || 0;
        } else {
          stock = ing.stock.reduce((acc: any, s: any) => acc + s.quantity, 0);
        }

        if (!inventoryNeeds[ing.id]) {
          inventoryNeeds[ing.id] = {
            ingredientId: ing.id,
            ingredientName: ing.name,
            currentStock: stock,
            projectedUsage: 0,
            stockAfter: 0,
            daysUntilStockout: null
          };
        }
        
        inventoryNeeds[ing.id].projectedUsage += usage;
      }
    }
  }

  // Calculate stats
  for (const key of Object.keys(inventoryNeeds)) {
    const item = inventoryNeeds[key];
    item.stockAfter = item.currentStock - item.projectedUsage;
    
    // Usage per day
    const usagePerDay = item.projectedUsage / 7;
    if (usagePerDay > 0) {
      item.daysUntilStockout = Math.round(item.currentStock / usagePerDay);
    }
  }

  const result = { inventory: Object.values(inventoryNeeds), generatedAt: new Date().toISOString() };
  await redis.setex(cacheKey, TTL, JSON.stringify(result));
  return result;
}

export async function preGenerateForecastsForTenant(tenantId: string) {
  console.log(`Pre-generating forecasts for tenant ${tenantId}...`);
  // Clear caches first
  const keys = await redis.keys(`forecast:*:${tenantId}:*`);
  if (keys.length) await redis.del(...keys);

  await generateRevenueForecast(tenantId);
  await generateBusyPeriods(tenantId);
  await generateItemsForecast(tenantId);
  await generateInventoryForecast(tenantId);

  // Also do it for active branches
  const branches = await prisma.branch.findMany({ where: { tenantId, isActive: true } });
  for (const branch of branches) {
    await generateRevenueForecast(tenantId, branch.id);
    await generateBusyPeriods(tenantId, branch.id);
    await generateItemsForecast(tenantId, branch.id);
    await generateInventoryForecast(tenantId, branch.id);
  }
}
