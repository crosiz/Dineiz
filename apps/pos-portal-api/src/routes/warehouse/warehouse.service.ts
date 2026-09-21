import { prisma } from '@dineiz/pos-portal-db';

export async function listSuppliers(branchId: string) {
  return prisma.supplier.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

export async function listBalances(branchId: string) {
  return prisma.supplierBalance.findMany({
    where: { supplier: { branchId } },
    include: { supplier: true },
    orderBy: { supplier: { name: 'asc' } },
  });
}

export async function listPayments(branchId: string) {
  return prisma.supplierPayment.findMany({
    where: { supplier: { branchId } },
    include: { supplier: true },
    orderBy: { createdAt: 'desc' },
  });
}
