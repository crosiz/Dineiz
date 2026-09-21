import { prisma } from '@dineiz/pos-portal-db';

export async function listActive(branchId: string) {
  return prisma.delivery.findMany({
    where: { branchId, status: { not: 'DELIVERED' } },
    include: { order: true, rider: true, zone: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listHistory(branchId: string) {
  return prisma.delivery.findMany({
    where: { branchId, status: 'DELIVERED' },
    include: { order: true, rider: true, zone: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function listRiders(branchId: string) {
  return prisma.rider.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listZones(branchId: string) {
  return prisma.deliveryZone.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}
