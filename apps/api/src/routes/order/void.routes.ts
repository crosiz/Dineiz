import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '@swiftserve/db';
import { deleteOrderItem } from './order.service';

const VoidRequestCreateSchema = z.object({
  branchId: z.string(),
  orderId: z.string(),
  orderItemId: z.string(),
  quantity: z.number(),
  reason: z.string().optional(),
});

const VoidRequestQuerySchema = z.object({
  branchId: z.string().optional(),
  orderId: z.string().optional(),
});

export const voidRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/pos/void-requests', {
    onRequest: [requireAuth],
    schema: { querystring: VoidRequestQuerySchema }
  }, async (request, reply) => {
    const user = request.user!;
    const query = request.query;

    if (!query.branchId && !query.orderId) {
      return reply.code(400).send({ error: 'branchId or orderId is required' });
    }

    const whereClause: any = {
      tenantId: user.tenantId,
    };
    if (!query.orderId) {
      whereClause.status = 'PENDING';
    }
    if (query.branchId) whereClause.branchId = query.branchId;
    if (query.orderId) whereClause.orderId = query.orderId;

    const requests = await prisma.voidRequest.findMany({
      where: whereClause,
      include: {
        order: true,
        orderItem: { include: { item: true } },
        cashier: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return requests;
  });

  fastify.post('/api/pos/void-requests', {
    onRequest: [requireAuth],
    schema: { body: VoidRequestCreateSchema }
  }, async (request, reply) => {
    const user = request.user!;
    const body = request.body;

    const newRequest = await prisma.voidRequest.create({
      data: {
        tenantId: user.tenantId,
        branchId: body.branchId,
        orderId: body.orderId,
        orderItemId: body.orderItemId,
        cashierId: user.id!,
        quantity: body.quantity,
        reason: body.reason || 'No reason provided',
        status: 'PENDING'
      }
    });

    return newRequest;
  });

  fastify.post('/api/pos/void-requests/:id/approve', {
    onRequest: [requireAuth],
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;

    const voidReq = await prisma.voidRequest.findUnique({
      where: { id, tenantId: user.tenantId }
    });

    if (!voidReq || voidReq.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Invalid or already processed request' });
    }

    try {
      // Process void
      await deleteOrderItem(
        user.tenantId,
        voidReq.orderId,
        voidReq.orderItemId,
        {
          reason: voidReq.reason,
          quantity: voidReq.quantity,
          approvedByManagerId: user.id!
        },
        voidReq.cashierId
      );

      try {
        await prisma.voidRequest.update({
          where: { id },
          data: { status: 'APPROVED' }
        });
      } catch (updateErr: any) {
        // If the entire order item was deleted, the VoidRequest might have been cascade-deleted.
        // We can safely ignore the RecordNotFound error in this case.
        if (updateErr.code !== 'P2025') {
          throw updateErr;
        }
      }

      return { success: true };
    } catch (e: any) {
      console.error('Void approval error:', e);
      return reply.code(500).send({ error: e.message || 'Internal Server Error' });
    }
  });

  fastify.post('/api/pos/void-requests/:id/reject', {
    onRequest: [requireAuth],
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params;

    const voidReq = await prisma.voidRequest.findUnique({
      where: { id, tenantId: user.tenantId }
    });

    if (!voidReq || voidReq.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Invalid or already processed request' });
    }

    const updated = await prisma.voidRequest.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    return updated;
  });
};
