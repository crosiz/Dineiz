import { prisma } from '@swiftserve/db';
import { differenceInDays } from 'date-fns';

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  if (typeof p !== 'number') throw new TypeError('p must be a number');
  if (p <= 0) return arr[0];
  if (p >= 100) return arr[arr.length - 1];

  arr.sort((a, b) => a - b);
  const index = (p / 100) * (arr.length - 1);
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index % 1;

  if (upper >= arr.length) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

export async function runCustomersSegmentsJob() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  
  for (const tenant of tenants) {
    await recalculateSegments(tenant.id);
  }
}

async function recalculateSegments(tenantId: string) {
  const customers = await prisma.customer.findMany({ where: { tenantId } });
  if (!customers.length) return;

  const p90Spend = percentile(customers.map(c => c.totalSpend), 90);
  const now = new Date();

  const updates = customers.map(customer => {
    let segment: string;
    const daysSinceLastVisit = differenceInDays(now, customer.lastVisitAt ?? new Date(0));

    if (customer.totalSpend >= p90Spend && customer.totalSpend > 0) {
      segment = 'VIP';
    } else if (customer.totalOrders >= 5 && daysSinceLastVisit <= 60) {
      segment = 'REGULAR';
    } else if (differenceInDays(now, customer.createdAt) <= 30) {
      segment = 'NEW';
    } else if (daysSinceLastVisit >= 45 && daysSinceLastVisit < 90) {
      segment = 'AT_RISK';
    } else if (daysSinceLastVisit >= 90) {
      segment = 'LOST';
    } else {
      segment = 'ACTIVE';
    }

    if (customer.segment !== segment) {
      return prisma.customer.update({ 
        where: { id: customer.id }, 
        data: { segment } 
      });
    }
    return Promise.resolve();
  });

  // Execute in batches of 100
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    await Promise.all(batch);
  }
}
