import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as ordersService from './orders.service';

const CreateOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  deliveryAddress: z.string().optional(),
  guests: z.number().int().positive().optional(),
  waiterId: z.string().optional(),
  lines: z.array(z.object({ menuItemId: z.string(), qty: z.number().int().positive() })).min(1),
});

const StatusSchema = z.object({ status: z.enum(['IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED']) });

const CheckoutSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'JAZZCASH', 'EASYPAISA']),
  tenderedAmount: z.number().int().optional(),
});

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/orders/live', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return ordersService.listLive(branchId);
  });

  fastify.get('/api/orders/history', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return ordersService.listHistory(branchId);
  });

  fastify.get('/api/orders/held', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return ordersService.listHeld(branchId);
  });

  fastify.post('/api/orders', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = CreateOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    try {
      const order = await ordersService.createOrder(branchId, request.user!.id, parsed.data);
      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/orders/:id/hold', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    try {
      return await ordersService.holdOrder(branchId, id, request.user!.id);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/orders/:id/resume', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    try {
      return await ordersService.resumeOrder(branchId, id, request.user!.id);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch('/api/orders/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const parsed = StatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request' });
    try {
      return await ordersService.updateStatus(branchId, id, request.user!.id, parsed.data.status);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/orders/:id/checkout', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const parsed = CheckoutSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    try {
      const payment = await ordersService.checkout(branchId, id, parsed.data);
      return reply.status(201).send(payment);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
