import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireTenant } from '../../middleware/auth';
import { handleSummary, handleRevenue, handleTopBranches, handleTopItems, handleAlerts, handleRecentOrders } from './tenant-dashboard.handlers';

export const tenantDashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/v1/tenant/dashboard/summary', { preHandler: requireTenant }, handleSummary);
  fastify.get('/api/v1/tenant/analytics/revenue', { preHandler: requireTenant }, handleRevenue);
  fastify.get('/api/v1/tenant/analytics/branches/top', { preHandler: requireTenant }, handleTopBranches);
  fastify.get('/api/v1/tenant/analytics/items/top', { preHandler: requireTenant }, handleTopItems);
  fastify.get('/api/v1/tenant/alerts', { preHandler: requireTenant }, handleAlerts);
  fastify.get('/api/v1/orders', { preHandler: requireTenant }, handleRecentOrders);
};
