import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { requireRole, requireTenant } from '../../middleware/auth';
import { z } from 'zod';

const AssignSchema = z.object({
  orderId: z.string().min(1),
  riderId: z.string().min(1),
});

export const riderRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // List unassigned delivery orders
  fastify.get('/api/rider/orders/unassigned', {
    preHandler: requireTenant,
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const orders = await prisma.order.findMany({
      where: { tenantId, type: 'DELIVERY', status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { riderAssignment: true },
    });
    return orders.filter((o) => !o.riderAssignment || o.riderAssignment.status === 'UNASSIGNED');
  });

  // Auto-assign: naive round-robin by least active assignments
  fastify.post('/api/rider/auto-assign', {
    schema: { body: z.object({ orderId: z.string().min(1) }) },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { orderId } = (request.body as any);

    const riders = await prisma.user.findMany({
      where: { tenantId, role: 'RIDER' },
      select: { id: true, name: true },
    });
    if (riders.length === 0) return reply.status(400).send({ error: 'No riders available' });

    const counts = await prisma.riderAssignment.groupBy({
      by: ['riderId'],
      where: { tenantId, status: { in: ['ASSIGNED', 'PICKED_UP'] } },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.riderId, c._count.id]));

    const chosen = riders
      .map((r) => ({ ...r, load: countMap.get(r.id) ?? 0 }))
      .sort((a, b) => a.load - b.load)[0];

    const assignment = await prisma.riderAssignment.upsert({
      where: { orderId },
      create: {
        tenantId,
        orderId,
        riderId: chosen.id,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
      update: {
        riderId: chosen.id,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
    });

    return { assigned: true, riderId: chosen.id, assignment };
  });

  // Manual assign
  fastify.post('/api/rider/assign', {
    schema: { body: AssignSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const { orderId, riderId } = (request.body as any);
    const assignment = await prisma.riderAssignment.upsert({
      where: { orderId },
      create: { tenantId, orderId, riderId, status: 'ASSIGNED', assignedAt: new Date() },
      update: { riderId, status: 'ASSIGNED', assignedAt: new Date() },
    });
    return assignment;
  });
};



