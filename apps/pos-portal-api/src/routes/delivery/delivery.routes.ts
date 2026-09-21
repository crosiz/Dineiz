import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as deliveryService from './delivery.service';

export const deliveryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/delivery/active', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return deliveryService.listActive(branchId);
  });

  fastify.get('/api/delivery/history', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return deliveryService.listHistory(branchId);
  });

  fastify.get('/api/delivery/riders', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return deliveryService.listRiders(branchId);
  });

  fastify.get('/api/delivery/zones', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return deliveryService.listZones(branchId);
  });
};
