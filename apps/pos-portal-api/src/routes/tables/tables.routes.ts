import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as tablesService from './tables.service';

export const tableRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/tables/sections', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return tablesService.listSections(branchId);
  });

  fastify.get('/api/tables/:id', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const result = await tablesService.getTable(branchId, id);
    if (!result) return reply.status(404).send({ error: 'Table not found' });
    return result;
  });

  fastify.get('/api/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return tablesService.listReservations(branchId);
  });
};
