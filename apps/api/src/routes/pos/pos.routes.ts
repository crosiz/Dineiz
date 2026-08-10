import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { z } from 'zod';
import { prisma } from '@dineiz/db';

export const posRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/pos/stats', {
    schema: {
      querystring: z.object({ shiftId: z.string() })
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, async (request, reply) => {
    const { shiftId } = request.query;
    const tenantId = (request.user!.tenantId as string);

    const where = { shiftId, status: 'COMPLETED' as const, tenantId };
    const [count, aggregate] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { netAmount: true } })
    ]);
    
    const total = aggregate._sum.netAmount ?? 0;
    return reply.send({
      ordersServed: count,
      totalValue: Math.round(Number(total)),
      avgPerOrder: count > 0 ? Math.round(Number(total) / count) : 0
    });
  });
};
