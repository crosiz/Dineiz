import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as marketingService from './marketing.service';

export const marketingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/marketing/promos', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return marketingService.listPromos(branchId);
  });

  fastify.get('/api/marketing/coupons', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return marketingService.listCoupons(branchId);
  });

  fastify.get('/api/marketing/campaigns', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return marketingService.listCampaigns(branchId);
  });
};
