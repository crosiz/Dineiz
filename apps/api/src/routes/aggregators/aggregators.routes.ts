import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import {
  handleListIntegrations,
  handleSaveIntegration,
  handleListMappings,
  handleSaveMappings,
  handleTestConnection,
  handleWebhook
} from './aggregators.handlers';

export const aggregatorsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/aggregators/integrations', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleListIntegrations);

  fastify.post('/api/aggregators/integrations', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleSaveIntegration);

  fastify.post('/api/aggregators/test', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleTestConnection);

  fastify.get('/api/aggregators/mappings/:provider', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleListMappings);

  fastify.post('/api/aggregators/mappings/:provider', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, handleSaveMappings);

  fastify.post('/api/aggregators/webhook', handleWebhook);
};
