import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as settingsService from './settings.service';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/settings', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return settingsService.getSettings(branchId);
  });

  fastify.patch('/api/settings', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return settingsService.updateSettings(branchId, request.body as Record<string, unknown>);
  });
};
