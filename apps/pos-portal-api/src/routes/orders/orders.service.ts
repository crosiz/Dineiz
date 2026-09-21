import { prisma } from '@dineiz/pos-portal-db';
import type { OrderStatus, OrderType, PaymentMethod } from '@dineiz/pos-portal-db';

export const CASH_TAX_RATE = 0.05;
export const CARD_TAX_RATE = 0.17;

// The only valid forward transitions. Anything not listed here is rejected —
// states are never skipped, and there is no path back out of a terminal state.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_KITCHEN', 'CANCELLED'],
  IN_KITCHEN: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

async function getOpenShift(branchId: string) {
  return prisma.shift.findFirst({ where: { branchId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
}

export async function createOrder(
  branchId: string,
  handledById: string,
  input: {
    type: OrderType;
    tableId?: string;
    customerName?: string;
    deliveryAddress?: string;
    guests?: number;
    waiterId?: string;
    lines: { menuItemId: string; qty: number }[];
  }
) {
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: input.lines.map((l) => l.menuItemId) }, branchId } });
  const priceById = new Map(menuItems.map((m) => [m.id, m]));

  const shift = await getOpenShift(branchId);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        branchId,
        type: input.type,
        tableId: input.tableId,
        customerName: input.customerName,
        deliveryAddress: input.deliveryAddress,
        guests: input.guests,
        waiterId: input.waiterId,
        handledById,
        shiftId: shift?.id,
        items: {
          create: input.lines.map((l) => {
            const item = priceById.get(l.menuItemId);
            if (!item) throw new Error(`Menu item ${l.menuItemId} not found on this branch`);
            return { menuItemId: item.id, nameSnapshot: item.name, priceSnapshot: item.price, qty: l.qty };
          }),
        },
      },
      include: { items: true },
    });

    if (input.type === 'DINE_IN' && input.tableId) {
      await tx.dineTable.update({ where: { id: input.tableId }, data: { status: 'OCCUPIED' } });
    }

    return created;
  });

  return order;
}

export async function listLive(branchId: string) {
  return prisma.order.findMany({
    where: { branchId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, heldAt: null },
    include: { items: true, table: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listHistory(branchId: string) {
  return prisma.order.findMany({
    where: { branchId, status: { in: ['COMPLETED', 'CANCELLED'] } },
    include: { items: true, table: true, payment: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function listHeld(branchId: string) {
  return prisma.order.findMany({
    where: { branchId, heldAt: { not: null } },
    include: { items: true, table: true },
    orderBy: { heldAt: 'desc' },
  });
}

export async function holdOrder(branchId: string, orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const updated = await prisma.order.update({ where: { id: orderId }, data: { heldAt: new Date(), heldById: userId } });
  await prisma.auditLog.create({ data: { branchId, orderId, userId, action: 'HELD' } });
  return updated;
}

export async function resumeOrder(branchId: string, orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const updated = await prisma.order.update({ where: { id: orderId }, data: { heldAt: null, heldById: null } });
  await prisma.auditLog.create({ data: { branchId, orderId, userId, action: 'RESUMED' } });
  return updated;
}

export async function updateStatus(branchId: string, orderId: string, userId: string, toStatus: OrderStatus) {
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed.includes(toStatus)) {
    throw new Error(`INVALID_TRANSITION: ${order.status} -> ${toStatus}`);
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: toStatus } }),
    prisma.auditLog.create({ data: { branchId, orderId, userId, action: 'STATUS_CHANGE', fromStatus: order.status, toStatus } }),
  ]);

  if (toStatus === 'CANCELLED' && order.tableId) {
    const stillOpen = await prisma.order.findFirst({ where: { tableId: order.tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
    if (!stillOpen) await prisma.dineTable.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
  }

  return updated;
}

export async function checkout(
  branchId: string,
  orderId: string,
  input: { method: PaymentMethod; tenderedAmount?: number }
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, branchId }, include: { items: true } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') throw new Error('ORDER_ALREADY_CLOSED');

  // Tax is always recomputed here from the method — the client's displayed
  // total is never trusted for the actual charge.
  const subtotal = order.items.reduce((sum, i) => sum + i.priceSnapshot * i.qty, 0);
  const taxRate = input.method === 'CASH' ? CASH_TAX_RATE : CARD_TAX_RATE;
  const taxAmount = Math.round(subtotal * taxRate);
  const total = subtotal + taxAmount;
  const changeAmount = input.method === 'CASH' && input.tenderedAmount != null ? input.tenderedAmount - total : null;

  const [, , payment] = await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } }),
    prisma.auditLog.create({ data: { branchId, orderId, action: 'STATUS_CHANGE', fromStatus: order.status, toStatus: 'COMPLETED' } }),
    prisma.payment.create({
      data: {
        orderId,
        method: input.method,
        subtotal,
        taxRate,
        taxAmount,
        total,
        tenderedAmount: input.tenderedAmount,
        changeAmount: changeAmount ?? undefined,
      },
    }),
  ]);

  // The actual fix for "table does not turn green/free after payment
  // collected" — freed the moment there's no other open order on it.
  if (order.tableId) {
    const stillOpen = await prisma.order.findFirst({ where: { tableId: order.tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
    if (!stillOpen) await prisma.dineTable.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
  }

  return payment;
}
