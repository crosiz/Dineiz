import { prisma } from '@dineiz/pos-portal-db';

export async function getCurrentShift(branchId: string) {
  const shift = await prisma.shift.findFirst({ where: { branchId, status: 'OPEN' }, include: { openedBy: true }, orderBy: { openedAt: 'desc' } });
  if (!shift) return null;

  const orders = await prisma.order.findMany({ where: { shiftId: shift.id }, include: { payment: true } });
  const ordersSoFar = orders.length;
  const salesSoFar = orders.reduce((sum, o) => sum + (o.payment?.total ?? 0), 0);
  const staffOnShift = await prisma.attendanceEntry.count({ where: { checkOut: null, user: { branchId } } });

  return { ...shift, ordersSoFar, salesSoFar, staffOnShift };
}

export async function openShift(branchId: string, openedById: string, openingFloat: number, notes?: string) {
  const existing = await prisma.shift.findFirst({ where: { branchId, status: 'OPEN' } });
  if (existing) throw new Error('SHIFT_ALREADY_OPEN');
  return prisma.shift.create({ data: { branchId, openedById, openingFloat, notes } });
}

async function computeExpectedCash(shiftId: string, openingFloat: number) {
  const cashPayments = await prisma.payment.findMany({ where: { method: 'CASH', order: { shiftId } } });
  return openingFloat + cashPayments.reduce((sum, p) => sum + p.total, 0);
}

export async function previewClose(branchId: string) {
  const shift = await prisma.shift.findFirst({ where: { branchId, status: 'OPEN' } });
  if (!shift) throw new Error('SHIFT_NOT_OPEN');
  const expectedCash = await computeExpectedCash(shift.id, shift.openingFloat);
  return { shiftId: shift.id, expectedCash };
}

export async function closeShift(branchId: string, shiftId: string, countedCash: number) {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, branchId, status: 'OPEN' } });
  if (!shift) throw new Error('SHIFT_NOT_OPEN');

  const expectedCash = await computeExpectedCash(shift.id, shift.openingFloat);
  const variance = countedCash - expectedCash;

  return prisma.shift.update({
    where: { id: shiftId },
    data: { status: 'CLOSED', closedAt: new Date(), expectedCash, countedCash, variance },
  });
}

export async function listHistory(branchId: string) {
  return prisma.shift.findMany({ where: { branchId, status: 'CLOSED' }, include: { openedBy: true }, orderBy: { closedAt: 'desc' }, take: 30 });
}

export async function listOpenOrdersCount(branchId: string) {
  return prisma.order.count({ where: { branchId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
}
