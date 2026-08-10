import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { 
  PromoCreateSchema, ComboCreateSchema, BxGyCreateSchema, ValidateDealsSchema,
  UnifiedDealCreateSchema, UnifiedDealUpdateSchema, PosEligibleDealsSchema, PosValidatePromoSchema
} from './deals.schema';
import {
  handleListPromos, handleCreatePromo, handleListCombos, handleCreateCombo,
  handleListBxGy, handleCreateBxGy, handleValidateDeals,
  handleListUnifiedDeals, handleGetUnifiedDeal, handleCreateUnifiedDeal, handleUpdateUnifiedDeal, handleDeleteUnifiedDeal, handleToggleUnifiedDeal,
  handlePosEligibleDeals, handlePosValidatePromo
} from './deals.handlers';

export const dealsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/deals/promos', { preHandler: requireTenant }, handleListPromos);
  fastify.post('/api/deals/promos', { schema: { body: PromoCreateSchema }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleCreatePromo);
  fastify.get('/api/deals/combos', { preHandler: requireTenant }, handleListCombos);
  fastify.post('/api/deals/combos', { schema: { body: ComboCreateSchema }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleCreateCombo);
  fastify.get('/api/deals/bxgy', { preHandler: requireTenant }, handleListBxGy);
  fastify.post('/api/deals/bxgy', { schema: { body: BxGyCreateSchema }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleCreateBxGy);
  fastify.post('/api/deals/validate', { schema: { body: ValidateDealsSchema }, preHandler: requireTenant }, handleValidateDeals);

  // UNIFIED DEALS (Dashboard Admin)
  fastify.get('/api/deals', { preHandler: requireTenant }, handleListUnifiedDeals);
  fastify.get('/api/deals/:id', { preHandler: requireTenant }, handleGetUnifiedDeal);
  
  fastify.post('/api/deals', { 
    schema: { body: UnifiedDealCreateSchema }, 
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) 
  }, handleCreateUnifiedDeal);
  
  fastify.put('/api/deals/:id', { 
    schema: { body: UnifiedDealUpdateSchema }, 
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) 
  }, handleUpdateUnifiedDeal);
  
  fastify.delete('/api/deals/:id', { preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleDeleteUnifiedDeal);
  
  fastify.post('/api/deals/:id/toggle', { preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleToggleUnifiedDeal);

  // POS DEALS EVALUATION
  fastify.get('/api/deals/eligible', { 
    preHandler: requireTenant 
  }, handlePosEligibleDeals);
  
  fastify.post('/api/promo-codes/validate', { 
    preHandler: requireTenant
  }, handlePosValidatePromo);
};
