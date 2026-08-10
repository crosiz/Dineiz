import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { CustomerUpsertSchema, PointsAdjustSchema, ListCustomersQuerySchema, CustomerIdParamSchema } from './crm.schema';
import { handleListCustomers, handleCreateCustomer, handleGetCustomer, handleAdjustPoints } from './crm.handlers';

export const crmRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/crm/customers', { schema: { querystring: ListCustomersQuerySchema }, preHandler: requireTenant }, handleListCustomers);
  fastify.post('/api/crm/customers', { schema: { body: CustomerUpsertSchema, response: { 201: z.any() } }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleCreateCustomer);
  fastify.get('/api/crm/customers/:id', { schema: { params: CustomerIdParamSchema }, preHandler: requireTenant }, handleGetCustomer);
  fastify.post('/api/crm/points', { schema: { body: PointsAdjustSchema, response: { 201: z.any() } }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleAdjustPoints);
};
