import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import { listBranches, getBranch, updateBranch } from './branch.service';

export const branchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/branches', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user?.tenantId) return reply.status(403).send({ error: 'No tenant' });
    return listBranches(request.user.tenantId);
  });

  fastify.get('/api/branches/current', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const branch = await getBranch(branchId);
    if (!branch) return reply.status(404).send({ error: 'Branch not found' });
    return branch;
  });

  fastify.patch('/api/branches/current', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return updateBranch(branchId, request.body as any);
  });
};
