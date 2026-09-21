import { prisma, type Branch } from '@dineiz/pos-portal-db';

export async function listBranches(tenantId: string): Promise<Branch[]> {
  return prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
}

export async function getBranch(branchId: string): Promise<Branch | null> {
  return prisma.branch.findUnique({ where: { id: branchId } });
}

export async function updateBranch(
  branchId: string,
  data: { name?: string; address?: string; phone?: string; operatingHours?: string }
): Promise<Branch> {
  return prisma.branch.update({ where: { id: branchId }, data });
}
