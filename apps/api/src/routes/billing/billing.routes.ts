import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import {
  handleGetSubscription,
  handleGetHistory,
  handleGetPlans,
  handleChangePlan,
  handleGetInvoice,
} from './billing.handlers';

export const billingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Only TENANT_ADMIN and SUPER_ADMIN can access billing
  const ADMIN_ROLES = ['TENANT_ADMIN', 'SUPER_ADMIN'];

  fastify.get('/api/billing/subscription', {
    preHandler: requireRole(ADMIN_ROLES)
  }, handleGetSubscription);

  fastify.get('/api/billing/history', {
    preHandler: requireRole(ADMIN_ROLES)
  }, handleGetHistory);

  fastify.get('/api/billing/plans', {
    preHandler: requireRole(ADMIN_ROLES)
  }, handleGetPlans);

  fastify.post('/api/billing/change-plan', {
    preHandler: requireRole(ADMIN_ROLES)
  }, handleChangePlan);

  fastify.get('/api/billing/invoice/:paymentId', {
    preHandler: requireRole(ADMIN_ROLES)
  }, handleGetInvoice);
};
