import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@dineiz/db';
import { mobileAuthMiddleware, MobileJwtPayload } from '../../middleware/mobileAuth.middleware';

export const mobileTablesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  // GET /api/mobile/tables
  fastify.get('/api/mobile/tables', async (request, reply) => {
    try {
      const { tenantId, branchId } = (request as any).mobileUser as MobileJwtPayload;
      if (!tenantId) return reply.status(400).send({ success: false, error: 'No tenant linked' });

      const tables = await prisma.table.findMany({
        where: { tenantId, ...(branchId ? { branchId } : {}) },
        orderBy: { label: 'asc' }
      });
      return reply.send({ success: true, data: tables });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // POST /api/mobile/tables
  fastify.post(
    '/api/mobile/tables',
    {
      schema: {
        body: z.object({
          label: z.string().min(1),
          capacity: z.number().int().min(1).default(4),
          shape: z.enum(['round', 'square', 'rectangle', 'booth']).default('square'),
          floorNumber: z.number().int().default(1)
        })
      }
    },
    async (request, reply) => {
      try {
        const { tenantId, branchId } = (request as any).mobileUser as MobileJwtPayload;
        if (!tenantId) return reply.status(400).send({ success: false, error: 'No tenant linked' });

        const { label, capacity, shape, floorNumber } = request.body as any;

        // Require a branchId — fall back to first branch for the tenant
        let targetBranchId = branchId;
        if (!targetBranchId) {
          const branch = await prisma.branch.findFirst({ where: { tenantId } });
          if (!branch) return reply.status(400).send({ success: false, error: 'No branch found for this tenant' });
          targetBranchId = branch.id;
        }

        const table = await prisma.table.create({
          data: {
            tenantId: tenantId!,
            branchId: targetBranchId,
            label,
            capacity,
            shape,
            floorNumber,
            positionX: 0,
            positionY: 0,
            width: 100,
            height: 100,
            rotation: 0
          }
        });

        return reply.send({ success: true, data: table });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/mobile/tables/:id
  fastify.delete(
    '/api/mobile/tables/:id',
    {
      schema: {
        params: z.object({ id: z.string() })
      }
    },
    async (request, reply) => {
      try {
        const { tenantId } = (request as any).mobileUser as MobileJwtPayload;
        const { id } = request.params as { id: string };

        const table = await prisma.table.findFirst({ where: { id, tenantId: tenantId! } });
        if (!table) return reply.status(404).send({ success: false, error: 'Table not found' });

        await prisma.table.delete({ where: { id } });
        return reply.send({ success: true });
      } catch (error: any) {
        return reply.status(500).send({ success: false, error: error.message });
      }
    }
  );
};
