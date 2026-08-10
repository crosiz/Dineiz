import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { createBranchSchema, updateBranchSchema } from '@dineiz/schemas';
import {
  handleListBranches,
  handleCreateBranch,
  handleUpdateBranch,
  handleToggleBranchStatus,
  handleDeleteBranch
} from './branches.handlers';

export const branchesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  console.log("REGISTERING BRANCHES ROUTES, createBranchSchema is:", typeof createBranchSchema);

  fastify.get('/api/branches', {
    preHandler: requireTenant
  }, handleListBranches);

  fastify.post('/api/branches', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleCreateBranch);

  fastify.put('/api/branches/:id', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleUpdateBranch);

  fastify.put('/api/branches/:id/toggle-status', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleToggleBranchStatus);

  fastify.delete('/api/branches/:id', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleDeleteBranch);
};
