import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as customersService from './customers.service';

export const customersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/customers', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return customersService.listCustomers(branchId);
  });

  fastify.get('/api/customers/segments', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return customersService.listSegments(branchId);
  });

  fastify.get('/api/customers/loyalty-tiers', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return customersService.listLoyaltyTiers(branchId);
  });

  fastify.get('/api/customers/feedback', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return customersService.listFeedback(branchId);
  });
};
