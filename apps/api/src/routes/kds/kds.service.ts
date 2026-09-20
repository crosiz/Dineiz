import { prisma } from '@dineiz/db';
import { emitOrderUpdated } from '../../lib/socket';
import { applyOrderStatusSideEffects } from '../order/order.service';
import { getTodayOrdersWhere } from '../../lib/date-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  variation: string | null;
  addons: string[];
  isReady: boolean;
  stationId: string | null;
  createdAt: string;
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
    (typeof opts.variation === 'string' ? opts.variation : opts.variation?.name) ?? opts.variationName ?? null;
  const rawAddons = opts.addOns ?? opts.addons;
  const addons: string[] = Array.isArray(rawAddons)
    ? rawAddons.map((a: any) => (typeof a === 'string' ? a : a?.name ?? ''))
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
    // Show the real, terminal-owned order number as-is (Part 4). Stripping
    // non-digits here turned "A-0827-001" into "0827001" on the KDS.
    orderNumber: o.orderNumber ? String(o.orderNumber) : `#${o.id.slice(-4)}`,
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

  // Spec Part 2 — the kitchen serves the whole branch, but only for shifts
  // that are open right now (plus shiftless QR/WhatsApp/aggregator orders
  // from today). Without this, a stale order under a long-closed shift — or
  // seeded historical data — sat on the KDS forever showing a "166 min"
  // timer.
  const shiftScope = await getTodayOrdersWhere(tenantId, branchId);

  const [rawOrders, inQueue, inProgress, completedToday, deliveredOrders, stations] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        branchId,
        status: { in: [...activeStatuses] },
        ...shiftScope,
        ...(stationId ? { items: itemWhere } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: ORDER_INCLUDE,
    }),
    prisma.order.count({ where: { tenantId, branchId, status: 'PENDING', ...shiftScope } }),
    prisma.order.count({ where: { tenantId, branchId, status: { in: ['PENDING', 'IN_KITCHEN'] }, ...shiftScope } }),
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
    where: { id: itemId, order: { tenantId } },
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
    throw Object.assign(new Error(`Cannot transition from ${existing.status} to ${toStatus}`), { statusCode: 409 });
  }

  const order = await prisma.$transaction(async tx => {
    if (toStatus === 'COMPLETED') {
      const payments = await tx.payment.aggregate({ where: { orderId: id, status: 'COMPLETED' }, _sum: { amount: true } });
      if (Number(payments._sum.amount ?? 0) + 0.01 < Number(existing.netAmount)) {
        throw Object.assign(new Error('Collect payment at the POS before completing this order.'), { statusCode: 409 });
      }
    }
    const changed = await tx.order.updateMany({ where: { id, tenantId, status: existing.status }, data: { status: toStatus as any } });
    if (!changed.count) {
      // Same race as bumpOrder below: a duplicate concurrent call (a
      // double-tap before the button's own busy guard caught it) can win
      // this exact transition a moment before we did. If the order is
      // already sitting at the status we were asked to reach, that's the
      // same intent having already succeeded, not a conflict — only a
      // status that isn't our target is a real one worth surfacing.
      const current = await tx.order.findUniqueOrThrow({ where: { id, tenantId }, select: { status: true } });
      if (current.status === toStatus) return tx.order.findUniqueOrThrow({ where: { id, tenantId }, include: ORDER_INCLUDE });
      throw Object.assign(new Error('Order changed. Refresh the kitchen ticket.'), { statusCode: 409 });
    }
    await tx.auditLog.create({ data: { action: 'ORDER_STATUS_CHANGED', targetTenantId: tenantId, before: { orderId: id, status: existing.status }, after: { orderId: id, status: toStatus }, notes: 'Kitchen transition' } });
    return tx.order.findUniqueOrThrow({ where: { id, tenantId }, include: ORDER_INCLUDE });
  });
  // Table status, cache invalidation, and — when this transition reaches
  // COMPLETED (deliverOrder below) — the inventory/loyalty/deal/Zapier/ERP
  // bundle that used to only ever run from the PUT /api/orders/:id path.
  // applyOrderStatusSideEffects already emits order:updated/order:cancelled
  // itself, so the standalone emitOrderUpdated call this used to end with
  // is gone — it's now inside the shared helper.
  await applyOrderStatusSideEffects(tenantId, order, existing.status, {});
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

  // A delayed retry must never edit a paid/cancelled order.
  if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
    return prisma.order.findUniqueOrThrow({ where: { id: orderId, tenantId }, include: ORDER_INCLUDE });
  }

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
    const STATUS_ORDER = ['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED'];
    const order = await prisma.$transaction(async tx => {
      // Keep every lifecycle step and its audit record, including older pending tickets.
      const steps = existing.status === 'PENDING' ? ['IN_KITCHEN', 'READY'] as const : ['READY'] as const;
      let from = existing.status;
      for (const status of steps) {
        const changed = await tx.order.updateMany({ where: { id: orderId, tenantId, status: from }, data: { status } });
        if (!changed.count) {
          // A concurrent bump (a duplicate offline-kitchen replay, or a
          // near-simultaneous second tap before the button's own busy guard
          // caught it) may have already carried this order past `from` —
          // that's not a conflict, it's the same intent having already won.
          // Only a status that never reaches this step (e.g. CANCELLED) is a
          // real conflict worth surfacing.
          const current = await tx.order.findUniqueOrThrow({ where: { id: orderId, tenantId }, select: { status: true } });
          if (STATUS_ORDER.indexOf(current.status) >= STATUS_ORDER.indexOf(status)) { from = current.status; continue; }
          throw Object.assign(new Error('Order changed. Refresh the kitchen ticket.'), { statusCode: 409 });
        }
        await tx.auditLog.create({ data: { action: 'ORDER_STATUS_CHANGED', targetTenantId: tenantId, before: { orderId, status: from }, after: { orderId, status }, notes: 'Kitchen ready' } });
        from = status;
      }
      return tx.order.findUniqueOrThrow({ where: { id: orderId, tenantId }, include: ORDER_INCLUDE });
    });
    await applyOrderStatusSideEffects(tenantId, order, existing.status, {});
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
  const existing = await prisma.order.findUnique({ where: { id, tenantId }, select: { status: true } });
  const order = await prisma.order.update({
    where: { id, tenantId },
    data: { status: 'CANCELLED', notes: reason },
  });
  await applyOrderStatusSideEffects(tenantId, order, existing?.status ?? null, {});
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
