import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as integrationsService from './integrations.service';

export const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/integrations/aggregators', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return integrationsService.listAggregators(branchId);
  });

  fastify.get('/api/integrations/payment-gateways', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return integrationsService.listPaymentGateways(branchId);
  });

  fastify.get('/api/integrations/webhooks', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return integrationsService.listWebhooks(branchId);
  });

  fastify.get('/api/integrations/printers', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return integrationsService.listPrinters(branchId);
  });
};
