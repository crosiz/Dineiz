import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { meiliSyncQueue } from '../../lib/queue';
import { z } from 'zod';

const TriggerSchema = z.object({
  entities: z.array(z.enum(['menu', 'customers'])).optional(),
});

export const searchSyncRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post('/api/search/sync', {
    schema: { body: TriggerSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const job = await meiliSyncQueue.add('sync', { tenantId, entities: (request.body as any).entities }, { removeOnComplete: true, removeOnFail: true });
    return { queued: true, jobId: job.id };
  });

  fastify.get('/api/search/health', {
    preHandler: requireTenant,
  }, async () => {
    return { status: 'ok' };
  });
};



