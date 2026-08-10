import { prisma } from '@dineiz/db';

export async function recalculateCrmSegments() {
  console.log('[CRM] Starting nightly segment recalculation...');

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const tenantId = tenant.id;

    // Fetch all customers for tenant
    const customers = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalOrders: true, totalSpend: true, lastVisitAt: true, createdAt: true }
    });

    if (!customers.length) continue;

    // Calculate VIP threshold (90th percentile of spend)
    const spends = customers.map(c => c.totalSpend).sort((a, b) => a - b);
    const p90Index = Math.floor(spends.length * 0.9);
    const vipThreshold = spends.length > 10 ? spends[p90Index] : Math.max(...spends) * 0.8;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const updates = customers.map(customer => {
      let segment = 'REGULAR';
      
      const isVip = customer.totalSpend >= vipThreshold && customer.totalSpend > 0;
      const isNew = customer.createdAt >= thirtyDaysAgo && customer.totalOrders <= 3;
      
      // Handle null lastVisitAt
      const lastVisitAt = customer.lastVisitAt || customer.createdAt;
      
      const isAtRisk = lastVisitAt < fortyFiveDaysAgo && lastVisitAt >= ninetyDaysAgo && customer.totalOrders >= 3;
      const isLost = lastVisitAt < ninetyDaysAgo && customer.totalOrders >= 2;
      const isRegular = customer.totalOrders >= 5 && lastVisitAt >= sixtyDaysAgo;

      if (isVip) segment = 'VIP';
      else if (isLost) segment = 'LOST';
      else if (isAtRisk) segment = 'AT_RISK';
      else if (isNew) segment = 'NEW';
      else if (isRegular) segment = 'REGULAR';
      else segment = 'REGULAR'; // Default fallback

      return prisma.customer.update({
        where: { id: customer.id },
        data: { segment }
      });
    });

    // Execute in batches
    await Promise.all(updates);
  }

  console.log('[CRM] Finished segment recalculation.');
}
