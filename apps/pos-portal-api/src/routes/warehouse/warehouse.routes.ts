import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as warehouseService from './warehouse.service';

export const warehouseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/warehouse/suppliers', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return warehouseService.listSuppliers(branchId);
  });

  fastify.get('/api/warehouse/balances', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return warehouseService.listBalances(branchId);
  });

  fastify.get('/api/warehouse/payments', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return warehouseService.listPayments(branchId);
  });
};
