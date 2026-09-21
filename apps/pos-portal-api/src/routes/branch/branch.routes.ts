import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole, resolveBranchId } from '../../middleware/auth';
import { listBranches, getBranch, updateBranch } from './branch.service';

const UpdateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
  operatingHours: z.string().max(100).optional(),
});

export const branchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/branches', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user?.tenantId) return reply.status(403).send({ error: 'No tenant' });
    return listBranches(request.user.tenantId);
  });

  fastify.get('/api/branches/current', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const branch = await getBranch(branchId);
    if (!branch) return reply.status(404).send({ error: 'Branch not found' });
    return branch;
  });

  fastify.patch('/api/branches/current', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']) }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = UpdateBranchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    return updateBranch(branchId, parsed.data);
  });
};
