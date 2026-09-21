import { prisma } from '@dineiz/pos-portal-db';

export async function listPromos(branchId: string) {
  return prisma.promo.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listCoupons(branchId: string) {
  return prisma.coupon.findMany({ where: { branchId }, orderBy: { code: 'asc' } });
}

export async function listCampaigns(branchId: string) {
  return prisma.campaign.findMany({ where: { branchId }, orderBy: { createdAt: 'desc' } });
}
