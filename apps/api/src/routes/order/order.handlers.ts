import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createOrder, listOrders, listOrderHistory, listLiveOrders, getOrder, updateOrder, enqueueOrderEvents, getActiveCount, assignOrder, appendOrderItems, deleteOrderItem, listActiveOrders
} from './order.service';
import {
  emitNewOrder, emitOrderUpdated, emitOrderCancelled, emitTableStatusChanged,
} from '../../lib/socket';
import { reverseOrDiscardInventoryForCancelledOrder } from '../inventory/inventory.service';
import { prisma } from '@dineiz/db';


export async function handleCreateOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const userId = request.user!.id!;
    const body = request.body as any;
    const order = await createOrder(tenantId, userId, body);

    emitNewOrder(tenantId, body.branchId, order);

    if (body.tableId) {
      // Fire-and-forget: the client already has its order confirmation, and the
      // table shouldn't need to wait on this write to turn occupied on-screen —
      // emit as soon as the (usually near-instant) DB write resolves in the background.
      prisma.table.update({
        where: { id: body.tableId, tenantId },
        data: { status: 'occupied' },
      }).then(() => {
        emitTableStatusChanged(body.branchId, {
          tableId: body.tableId,
          status: 'occupied',
          orderId: order.id,
          since: order.createdAt.toISOString(),
        }, tenantId);
      }).catch((e: any) => console.warn('[Order] Table status update failed:', e.message));
    }

    return reply.status(201).send(order);
  } catch (e: any) {
    console.error('CREATE ORDER ERROR:', e);
    if (e.message === 'PLAN_LIMIT_EXCEEDED') {
      return reply.status(402).send({ error: 'PLAN_LIMIT_EXCEEDED', message: 'Daily order limit reached for your plan.' });
    }
    return reply.status(500).send({ error: e.message });
  }
}

export async function handleAssignOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params as any;
    const body = request.body as any;
    const order = await assignOrder(tenantId, id, body);
    
    // Emit order:assigned via Socket.io to trigger POS update
    const io = (global as any).io || require('../../lib/socket').getIO();
    if (io) {
      io.of('/pos').to(`branch:${order.branchId}`).emit('order:assigned', {
        orderId: order.id,
        tableId: order.tableId,
        assignedWaiterId: order.assignedWaiterId,
        assignedWaiterName: order.assignedWaiterName,
        assignedWaiterColor: order.assignedWaiter?.avatarColor || null,
        assignedAt: order.assignedAt?.toISOString()
      });
    }

    return reply.send(order);
  } catch (e: any) {
    console.error('ASSIGN ORDER ERROR:', e);
    return reply.status(500).send({ error: e.message });
  }
}

export async function handleListOrders(request: FastifyRequest, reply: FastifyReply) {
  return listOrders(request.user!.tenantId!, request.scopedBranchId ?? undefined, request.query as any);
}

export async function handleListOrderHistory(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  return listOrderHistory(tenantId, request.scopedBranchId ?? undefined, request.query as any);
}

export async function handleListLiveOrders(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const q = request.query as any;
  const branchId = (request.scopedBranchId ?? undefined) || q.branchId;
  return listLiveOrders(tenantId, branchId);
}

export async function handleGetActiveCount(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const q = request.query as any;
  const branchId = (request.scopedBranchId ?? undefined) || q.branchId;
  return getActiveCount(tenantId, branchId);
}

export async function handleListActiveOrders(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const query = request.query as any;
  if (!query.branchId) {
    return reply.status(400).send({ error: 'branchId is required' });
  }
  const orders = await listActiveOrders(tenantId, query.branchId);
  return reply.send({ orders });
}

export async function handleGetOrder(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { id } = request.params as any;
  const order = await getOrder(tenantId, id);
  if (!order) return reply.status(404).send({ error: 'Order not found' });
  return order;
}

export async function handleUpdateOrder(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const { id } = request.params as any;

  // Sync Point 4: capture the pre-update status so a transition into CANCELLED
  // can tell whether the order ever reached the kitchen (restore stock) or not (log wastage instead).
  const priorOrder = await prisma.order.findUnique({ where: { id, tenantId }, select: { status: true } });

  const order = await updateOrder(tenantId, id, request.body);

  if (order.status === 'CANCELLED' && priorOrder && priorOrder.status !== 'CANCELLED') {
    reverseOrDiscardInventoryForCancelledOrder(order.id, priorOrder.status).catch((e: any) => console.error('Inventory Reversal Error:', e));
  }

  if (order.status === 'CANCELLED') {
    emitOrderCancelled(tenantId, order.branchId, order.id);
  } else {
    emitOrderUpdated(tenantId, order.branchId, order);
  }

  if (order.tableId) {
    // Fire-and-forget: don't make the client wait on this write before it sees
    // its order update confirmed — emit as soon as the DB write resolves.
    // Lowercase to match the Table.status column's documented convention
    // (schema.prisma: "free", "occupied", "dirty", "ready", "reserved") and
    // emitTableStatusChanged's own signature — the previous uppercase values
    // here were a pre-existing type/casing mismatch against both.
    let newTableStatus: 'occupied' | 'free' | null = null;
    if (order.status === 'READY') newTableStatus = 'occupied';
    else if (order.status === 'COMPLETED' || order.status === 'CANCELLED') newTableStatus = 'free';

    if (newTableStatus) {
      prisma.table.update({ where: { id: order.tableId, tenantId }, data: { status: newTableStatus } })
        .then(() => {
          emitTableStatusChanged(order.branchId, {
            tableId: order.tableId,
            status: newTableStatus,
            ...(newTableStatus === 'occupied' ? { orderId: order.id, since: order.createdAt.toISOString() } : {}),
          }, tenantId);
        })
        .catch((e: any) => console.warn('[Order] Table status update failed:', e.message));
    }
  }

  await enqueueOrderEvents(
    tenantId, 
    order, 
    (request.body as any).payments, 
    (request.body as any).redeemedPointsAmount
  );
  return order;
}

export async function handleAppendOrderItems(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params as any;
    const { items } = request.body as any;

    const order = await appendOrderItems(tenantId, id, items);

    return reply.status(200).send(order);
  } catch (e: any) {
    console.error('APPEND ORDER ITEMS ERROR:', e);
    return reply.status(500).send({ error: e.message });
  }
}
export async function handleDeleteOrderItem(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { id, itemId } = request.params as any;
    const body = request.body as any;


    const order = await deleteOrderItem(tenantId, id, itemId, body, request.user!.id!);

    emitOrderUpdated(tenantId, order.branchId, order);
    await enqueueOrderEvents(tenantId, order);

    return reply.status(200).send(order);
  } catch (e: any) {
    console.error('DELETE ORDER ITEM ERROR:', e);
    return reply.status(500).send({ error: e.message });
  }
}
