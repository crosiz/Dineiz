import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireAuth } from '../../middleware/auth';
import {
  getSettingsHandler,
  updateSettingsHandler,
  listTiersHandler,
  createTierHandler,
  updateTierHandler,
  deleteTierHandler,
  listCampaignsHandler,
  createCampaignHandler,
  updateCampaignHandler,
  deleteCampaignHandler,
  getDashboardMetricsHandler
} from './loyalty.handlers';
import {
  SettingsUpdateSchema,
  TierCreateSchema,
  TierUpdateSchema,
  CampaignCreateSchema,
  CampaignUpdateSchema
} from './loyalty.schema';

export const loyaltyRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const authRole = requireRole(['TENANT_ADMIN']);


  // Allow cashiers (and POS) to fetch settings for checkout
  fastify.get('/settings', { preHandler: requireAuth }, getSettingsHandler);
  
  fastify.put('/settings', {
    preHandler: authRole,
    schema: { body: SettingsUpdateSchema }
  }, updateSettingsHandler);

  fastify.get('/tiers', { preHandler: authRole }, listTiersHandler);
  
  fastify.post('/tiers', {
    preHandler: authRole,
    schema: { body: TierCreateSchema }
  }, createTierHandler);
  
  fastify.put('/tiers/:id', {
    preHandler: authRole,
    schema: { body: TierUpdateSchema }
  }, updateTierHandler);
  
  fastify.delete('/tiers/:id', { preHandler: authRole }, deleteTierHandler);

  fastify.get('/campaigns', { preHandler: authRole }, listCampaignsHandler);
  
  fastify.post('/campaigns', {
    preHandler: authRole,
    schema: { body: CampaignCreateSchema }
  }, createCampaignHandler);
  
  fastify.put('/campaigns/:id', {
    preHandler: authRole,
    schema: { body: CampaignUpdateSchema }
  }, updateCampaignHandler);
  
  fastify.delete('/campaigns/:id', { preHandler: authRole }, deleteCampaignHandler);

  fastify.get('/dashboard', { preHandler: authRole }, getDashboardMetricsHandler);
};
