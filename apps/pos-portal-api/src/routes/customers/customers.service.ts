import { prisma } from '@dineiz/pos-portal-db';

export async function listCustomers(branchId: string) {
  return prisma.customer.findMany({ where: { branchId }, orderBy: { totalSpent: 'desc' } });
}

export async function listSegments(branchId: string) {
  return prisma.customerSegment.findMany({ where: { branchId } });
}

export async function listLoyaltyTiers(branchId: string) {
  const tiers = await prisma.loyaltyTier.findMany({ where: { branchId }, orderBy: { minPoints: 'asc' } });
  return Promise.all(
    tiers.map(async (tier) => {
      const members = await prisma.customer.count({
        where: { branchId, tier: tier.name.toUpperCase() as 'BRONZE' | 'SILVER' | 'GOLD' },
      });
      return { ...tier, members };
    }),
  );
}

export async function listFeedback(branchId: string) {
  return prisma.feedback.findMany({
    where: { branchId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
}
