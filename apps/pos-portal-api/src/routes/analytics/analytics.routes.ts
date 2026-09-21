import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as analyticsService from './analytics.service';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/analytics/summary', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return analyticsService.getSalesSummary(branchId);
  });

  fastify.get('/api/analytics/top-items', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return analyticsService.getTopItems(branchId);
  });

  fastify.get('/api/analytics/staff-performance', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return analyticsService.getStaffPerformance(branchId);
  });
};
