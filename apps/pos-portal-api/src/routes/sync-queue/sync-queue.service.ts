import { prisma } from '@dineiz/pos-portal-db';

export async function listRecent(branchId: string) {
  return prisma.syncQueueEntry.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function logEntry(branchId: string, kind: string, label: string) {
  return prisma.syncQueueEntry.create({ data: { branchId, kind, label } });
}
