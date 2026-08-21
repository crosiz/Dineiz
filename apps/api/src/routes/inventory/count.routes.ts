import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { CountQuerySchema, CountIdParamSchema, CountStartSchema, CountLineUpdateSchema, CountCompleteSchema } from './count.schema';
import {
  handleGetCounts, handleGetCountById, handleStartCount,
  handleUpdateCountLine, handleCompleteCount, handleCancelCount, handleVarianceReport,
} from './count.handlers';

const MANAGE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'];

export const countRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/inventory/counts', { schema: { querystring: CountQuerySchema }, preHandler: requireTenant }, handleGetCounts);
  fastify.get('/api/inventory/counts/:id', { schema: { params: CountIdParamSchema }, preHandler: requireTenant }, handleGetCountById);
  fastify.post('/api/inventory/counts/start', { schema: { body: CountStartSchema } , preHandler: requireRole(MANAGE_ROLES) }, handleStartCount);
  fastify.put('/api/inventory/counts/:id/line', { schema: { params: CountIdParamSchema, body: CountLineUpdateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleUpdateCountLine);
  fastify.post('/api/inventory/counts/:id/complete', { schema: { params: CountIdParamSchema, body: CountCompleteSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCompleteCount);
  fastify.post('/api/inventory/counts/:id/cancel', { schema: { params: CountIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCancelCount);
  fastify.get('/api/inventory/counts/:id/variance-report', { schema: { params: CountIdParamSchema }, preHandler: requireTenant }, handleVarianceReport);
};
