import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { rewardsQueue } from '../../lib/queue';
import { z } from 'zod';

const TriggerSchema = z.object({
  tenantId: z.string().min(1).optional(),
});

export const rewardsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Manual trigger for ops/testing (normally scheduled externally)
  fastify.post('/api/rewards/birthday/run', {
    schema: { body: TriggerSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, async (request) => {
    const tenantId = (request.body as any).tenantId ?? request.user!.tenantId!;
    const job = await rewardsQueue.add('birthday', { tenantId }, { removeOnComplete: true, removeOnFail: true });
    return { queued: true, jobId: job.id };
  });
};



