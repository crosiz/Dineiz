import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createOrder, listOrders, listOrderHistory, listLiveOrders, getOrder, updateOrder, enqueueOrderEvents, applyOrderStatusSideEffects, getActiveCount, assignOrder, appendOrderItems, deleteOrderItem, listActiveOrders
} from './order.service';
import { emitNewOrder, emitOrderUpdated } from '../../lib/socket';
import { prisma } from '@dineiz/db';
import { withIdempotency } from '../../lib/idempotency';
import { getCurrentShift } from '../shift/shift.service';
import { recomputeTableStatus } from '../../lib/tableStatus';


export async function handleCreateOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const userId = request.user!.id!;
    const body = request.body as any;
    // A client-generated order id (lib/core/commands.ts's createOrder on
    // the POS) is already a natural idempotency key — the outbox
    // (lib/core/outbox.ts) sends it so a request that times out
    // client-side after actually succeeding server-side doesn't create a
    // second, duplicate order on retry.
    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;

    const { statusCode, body: responseBody } = await withIdempotency(
      tenantId,
      'POST /api/orders',
      idempotencyKey,
      async () => {
        const order = await createOrder(tenantId, userId, body);

        emitNewOrder(tenantId, body.branchId, order);

        if (body.tableId) {
          // Part 3 — don't write a literal "occupied" here. Derive the
          // table's status from the orders actually on it (this new one
          // included) via the single server writer. Fire-and-forget: the
          // client already has its confirmation and shows the table busy
          // from its own reducer.
          recomputeTableStatus(tenantId, body.tableId).catch(() => {});
        }

        return { statusCode: 201, body: order };
      }
    );

    return reply.status(statusCode).send(responseBody);
  } catch (e: any) {
    console.error('CREATE ORDER ERROR:', e);
    if (e.message === 'PLAN_LIMIT_EXCEEDED') {
      return reply.status(402).send({ error: 'PLAN_LIMIT_EXCEEDED', message: 'Daily order limit reached for your plan.' });
    }
    // resolveAppliedTax throws 422 on a tax mismatch; createOrder throws 409
    // on a genuine cross-terminal order-number collision (Part 4).
    if (typeof e.statusCode === 'number') {
      return reply.status(e.statusCode).send({ error: e.message });
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
  const role = request.user!.role as string | undefined;

  // Spec Part 2 — a CASHIER only ever sees their own shift's orders, never
  // another terminal's cart or a previous shift. Trust an explicit shiftId
  // from the POS; if it's missing, resolve the cashier's current open shift
  // so the scoping can't be bypassed by just omitting the param. Managers /
  // admins get the branch-wide board unless they ask for a specific shift.
  let shiftId: string | null | undefined = q.shiftId;
  if (role === 'CASHIER' && !shiftId && branchId) {
    const current = await getCurrentShift(branchId, tenantId, request.user!.id!);
    shiftId = current?.id ?? '__none__'; // no open shift → deliberately match nothing
  }

  return listLiveOrders(tenantId, branchId, { shiftId });
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

  // Table status (free/occupied), inventory reversal on cancel, cache
  // invalidation, and the COMPLETED/CANCELLED event bundle — shared with
  // the KDS and mobile status-update paths (order.service.ts) so all three
  // behave identically instead of each reimplementing a subset of this.
  await applyOrderStatusSideEffects(tenantId, order, priorOrder?.status ?? null, {
    payments: (request.body as any).payments,
    redeemedPointsAmount: (request.body as any).redeemedPointsAmount,
  });
  return order;
}

export async function handleAppendOrderItems(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params as any;
    const { items } = request.body as any;
    // Same reasoning as handleCreateOrder — a timed-out-but-actually-
    // succeeded append would otherwise add the same items twice on retry.
    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;

    const { statusCode, body: responseBody } = await withIdempotency(
      tenantId,
      'POST /api/orders/:id/items',
      idempotencyKey,
      async () => {
        const order = await appendOrderItems(tenantId, id, items);
        return { statusCode: 200, body: order };
      }
    );

    return reply.status(statusCode).send(responseBody);
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
