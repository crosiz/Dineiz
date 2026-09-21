import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as syncQueueService from './sync-queue.service';

const LogEntrySchema = z.object({
  kind: z.enum(['payment']),
  label: z.string().min(1),
});

export const syncQueueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sync-queue', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return syncQueueService.listRecent(branchId);
  });

  fastify.post('/api/sync-queue', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = LogEntrySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    const entry = await syncQueueService.logEntry(branchId, parsed.data.kind, parsed.data.label);
    return reply.status(201).send(entry);
  });
};
