import { prisma } from '@dineiz/pos-portal-db';

export async function listSections(branchId: string) {
  return prisma.tableSection.findMany({
    where: { branchId },
    orderBy: { sortOrder: 'asc' },
    include: { tables: { orderBy: { label: 'asc' } } },
  });
}

export async function getTable(branchId: string, tableId: string) {
  const table = await prisma.dineTable.findFirst({ where: { id: tableId, branchId }, include: { section: true } });
  if (!table) return null;

  const currentOrder = await prisma.order.findFirst({
    where: { tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    include: { items: true, waiter: true },
    orderBy: { createdAt: 'desc' },
  });

  return { table, currentOrder };
}

export async function listReservations(branchId: string) {
  return prisma.reservation.findMany({ where: { branchId }, include: { table: true }, orderBy: { time: 'asc' } });
}
