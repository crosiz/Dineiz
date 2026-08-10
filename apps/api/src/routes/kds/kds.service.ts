import { prisma } from '@swiftserve/db';
import { emitOrderUpdated, emitOrderCancelled } from '../../lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  variation: string | null;
  addons: string[];
  isReady: boolean;
  stationId: string | null;
}

export interface KdsOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  tableLabel: string | null;
  token: string | null;
  isRush: boolean;
  isDelayed: boolean;
  isNew: boolean;
  createdAt: string;
  secondsElapsed: number;
  items: KdsOrderItem[];
}

export interface KdsSummary {
  inQueue: number;
  inProgress: number;
  completedToday: number;
  avgPrepTimeSeconds: number;
}

export interface KdsStationInfo {
  id: string;
  name: string;
  orderCount: number;
  color: string;
}

export interface KdsAlert {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'error';
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_INCLUDE = {
  items: {
    include: {
      item: { select: { name: true, image: true } },
      kdsStation: { select: { id: true, name: true, color: true } },
    },
  },
  table: { select: { label: true } },
} as const;

function mapOrderItem(oi: any): KdsOrderItem {
  const opts = (oi.options as any) ?? {};
  const variation: string | null =
    opts.variation ?? opts.variationName ?? null;
  const addons: string[] = Array.isArray(opts.addons)
    ? opts.addons.map((a: any) => (typeof a === 'string' ? a : a?.name ?? ''))
    : [];

  return {
    id: oi.id,
    name: oi.item?.name ?? 'Item',
    quantity: oi.quantity,
    variation,
    addons,
    isReady: oi.kdsStatus === 'DONE',
    stationId: oi.kdsStationId ?? null,
    createdAt: oi.createdAt instanceof Date ? oi.createdAt.toISOString() : oi.createdAt,
  };
}

function mapOrder(o: any, now: number): KdsOrder {
  const secondsElapsed = Math.floor((now - new Date(o.createdAt).getTime()) / 1000);
  const minutes = Math.floor(secondsElapsed / 60);
  return {
    id: o.id,
    orderNumber: String(o.orderNumber ?? o.id.slice(-3)).replace(/\D/g, '').padStart(3, '0'),
    status: o.status,
    type: o.type,
    tableLabel: o.table?.label ?? null,
    token: o.tokenNumber ?? null,
    isRush: minutes > 15,
    isDelayed: minutes > 20,
    isNew: minutes < 1,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    secondsElapsed,
    items: (o.items ?? []).map(mapOrderItem),
  };
}

// ─── Main KDS Dashboard Query ─────────────────────────────────────────────────

export async function getKdsDashboard(
  tenantId: string,
  branchId: string,
  stationId?: string,
): Promise<{ orders: KdsOrder[]; summary: KdsSummary; stations: KdsStationInfo[]; alerts: KdsAlert[] }> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const activeStatuses = ['PENDING', 'IN_KITCHEN', 'READY'] as const;

  // Build item station filter
  const itemWhere = stationId
    ? { some: { kdsStationId: stationId } }
    : undefined;

  const [rawOrders, inQueue, inProgress, completedToday, deliveredOrders, stations] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        branchId,
        status: { in: [...activeStatuses] },
        ...(stationId ? { items: itemWhere } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: ORDER_INCLUDE,
    }),
    prisma.order.count({ where: { tenantId, branchId, status: 'PENDING' } }),
    prisma.order.count({ where: { tenantId, branchId, status: { in: ['PENDING', 'IN_KITCHEN'] } } }),
    prisma.order.count({
      where: { tenantId, branchId, status: 'COMPLETED', createdAt: { gte: todayStart } },
    }),
    // For avg prep time: delivered orders today with updatedAt - createdAt
    prisma.order.findMany({
      where: { tenantId, branchId, status: 'COMPLETED', updatedAt: { gte: todayStart } },
      select: { createdAt: true, updatedAt: true },
      take: 100,
    }),
    prisma.kdsStation.findMany({
      where: { tenantId, branchId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: { 
        orderItems: { 
          where: { 
            kdsStatus: { in: ['WAITING', 'IN_PROGRESS'] },
            order: { 
              createdAt: { gte: todayStart },
              status: { in: ['PENDING', 'IN_KITCHEN'] }
            }
          } 
        } 
      },
    }),
  ]);

  // Avg prep time
  let avgPrepTimeSeconds = 0;
  if (deliveredOrders.length > 0) {
    const totalSeconds = deliveredOrders.reduce((sum, o) => {
      return sum + Math.floor((o.updatedAt.getTime() - o.createdAt.getTime()) / 1000);
    }, 0);
    avgPrepTimeSeconds = Math.floor(totalSeconds / deliveredOrders.length);
  }

  let orders: KdsOrder[] = [];
  for (const raw of rawOrders) {
    const baseOrder = mapOrder(raw, now);
    
    // Group items by addition time (30 sec rounding)
    const groups: Record<number, any[]> = {};
    for (const item of raw.items) {
      const time = Math.floor(new Date(item.createdAt).getTime() / 30000) * 30000;
      if (!groups[time]) groups[time] = [];
      groups[time].push(item);
    }
    
    const times = Object.keys(groups).map(Number).sort((a, b) => a - b);
    
    if (times.length <= 1) {
      const isCardReady = baseOrder.items.length > 0 && baseOrder.items.every(item => item.isReady);
      orders.push({
        ...baseOrder,
        status: isCardReady ? 'READY' : baseOrder.status
      });
    } else {
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const isOriginal = i === 0;
        const groupItems = groups[time].map(mapOrderItem);
        
        const isCardReady = groupItems.every(item => item.isReady);
        
        const secondsElapsed = Math.floor((now - time) / 1000);
        const minutes = Math.floor(secondsElapsed / 60);

        orders.push({
          ...baseOrder,
          id: isOriginal ? baseOrder.id : `${baseOrder.id}-add-${time}`,
          orderNumber: isOriginal ? baseOrder.orderNumber : `${baseOrder.orderNumber} (Add)`,
          status: isCardReady ? 'READY' : baseOrder.status,
          secondsElapsed,
          isRush: minutes > 15,
          isDelayed: minutes > 20,
          isNew: minutes < 1,
          items: groupItems,
          createdAt: new Date(time).toISOString(),
        });
      }
    }
  }

  if (stationId) {
    orders = orders.map(order => ({
      ...order,
      items: order.items.filter(item => item.stationId === stationId)
    }));
  }

  const stationInfos: KdsStationInfo[] = stations.map(s => ({
    id: s.id,
    name: s.name,
    orderCount: s.orderItems.length,
    color: s.color,
  }));

  const alerts: KdsAlert[] = [];

  return {
    orders,
    summary: { inQueue, inProgress, completedToday, avgPrepTimeSeconds },
    stations: stationInfos,
    alerts,
  };
}

// ─── Item-level ready ─────────────────────────────────────────────────────────

export async function markItemReady(tenantId: string, itemId: string) {
  const oi = await prisma.orderItem.update({
    where: { id: itemId },
    data: { kdsStatus: 'DONE' },
    include: { order: { select: { branchId: true, id: true } } },
  });
  return oi;
}

// ─── Order transitions ────────────────────────────────────────────────────────

async function transitionOrder(tenantId: string, id: string, fromStatus: string | string[], toStatus: string) {
  const existing = await prisma.order.findUnique({ where: { id, tenantId } });
  if (!existing) throw new Error("Order not found");

  const allowedStatuses = Array.isArray(fromStatus) ? fromStatus : [fromStatus];
  if (!allowedStatuses.includes(existing.status)) {
    if (existing.status === toStatus) {
      return prisma.order.findUnique({ where: { id, tenantId }, include: ORDER_INCLUDE });
    }
    // Allow bumping from PENDING straight to READY
    if (toStatus === 'READY' && existing.status === 'PENDING') {
      // Proceed
    } else {
      throw new Error(`Cannot transition from ${existing.status} to ${toStatus}`);
    }
  }

  const order = await prisma.order.update({
    where: { id, tenantId },
    data: { status: toStatus as any },
    include: ORDER_INCLUDE,
  });
  emitOrderUpdated(tenantId, order.branchId, order);
  return order;
}

export const startOrder   = (tenantId: string, id: string) => transitionOrder(tenantId, id, 'PENDING',    'IN_KITCHEN');

export async function bumpOrder(tenantId: string, fullId: string) {
  let orderId = fullId;
  let additionTime: number | null = null;
  if (fullId.includes('-add-')) {
    const parts = fullId.split('-add-');
    orderId = parts[0];
    additionTime = parseInt(parts[1], 10);
  }

  const existing = await prisma.order.findUnique({ 
    where: { id: orderId, tenantId },
    include: { items: true }
  });
  if (!existing) throw new Error("Order not found");

  let itemsToUpdate = existing.items;
  
  const groups: Record<number, any[]> = {};
  for (const item of existing.items) {
    const time = Math.floor(new Date(item.createdAt).getTime() / 30000) * 30000;
    if (!groups[time]) groups[time] = [];
    groups[time].push(item);
  }
  const times = Object.keys(groups).map(Number).sort((a, b) => a - b);

  if (additionTime) {
    itemsToUpdate = groups[additionTime] || [];
  } else if (times.length > 0) {
    itemsToUpdate = groups[times[0]];
  }

  if (itemsToUpdate.length > 0) {
    await prisma.orderItem.updateMany({
      where: { id: { in: itemsToUpdate.map(i => i.id) } },
      data: { kdsStatus: 'DONE' }
    });
  }

  const allItems = await prisma.orderItem.findMany({ where: { orderId } });
  const allDone = allItems.length > 0 && allItems.every(i => i.kdsStatus === 'DONE');

  if (allDone && existing.status !== 'READY' && existing.status !== 'COMPLETED' && existing.status !== 'CANCELLED') {
    const order = await prisma.order.update({
      where: { id: orderId, tenantId },
      data: { status: 'READY' },
      include: ORDER_INCLUDE,
    });
    emitOrderUpdated(tenantId, order.branchId, order);
    return order;
  } else {
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId },
      include: ORDER_INCLUDE,
    });
    emitOrderUpdated(tenantId, order!.branchId, order!);
    return order!;
  }
}

export const recallOrder  = (tenantId: string, id: string) => transitionOrder(tenantId, id, 'READY',      'IN_KITCHEN');
export const deliverOrder = (tenantId: string, id: string) => transitionOrder(tenantId, id, 'READY',      'COMPLETED');

export async function cancelOrderKds(tenantId: string, id: string, reason?: string) {
  const order = await prisma.order.update({
    where: { id, tenantId },
    data: { status: 'CANCELLED', notes: reason },
  });
  emitOrderCancelled(tenantId, order.branchId, order.id);
  return order;
}

// ─── Legacy history / stats (unchanged) ──────────────────────────────────────

const ORDER_INCLUDE_LEGACY = {
  items: { include: { item: { select: { name: true, image: true } } } },
} as const;

export async function getKdsHistory(tenantId: string, branchId: string, limit: number) {
  return prisma.order.findMany({
    where: { tenantId, branchId, status: { in: ['READY', 'COMPLETED'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: ORDER_INCLUDE_LEGACY,
  });
}

export async function getKdsStats(tenantId: string, branchId: string, shiftId?: string) {
  const where = { tenantId, branchId, ...(shiftId ? { shiftId } : {}) };
  const [pending, inKitchen, ready, delivered, cancelled] = await Promise.all([
    prisma.order.count({ where: { ...where, status: 'PENDING' } }),
    prisma.order.count({ where: { ...where, status: 'IN_KITCHEN' } }),
    prisma.order.count({ where: { ...where, status: 'READY' } }),
    prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
  ]);
  const oldestPending = await prisma.order.findFirst({
    where: { ...where, status: { in: ['PENDING', 'IN_KITCHEN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, tokenNumber: true },
  });
  const oldestAgeSeconds = oldestPending
    ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 1000)
    : null;
  return {
    counts: { pending, inKitchen, ready, delivered, cancelled },
    oldestPending: oldestPending
      ? { id: oldestPending.id, tokenNumber: oldestPending.tokenNumber, ageSeconds: oldestAgeSeconds }
      : null,
    isRush: (oldestAgeSeconds ?? 0) > 600,
  };
}
