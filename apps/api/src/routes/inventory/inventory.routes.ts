import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import {
  InventorySummaryQuerySchema, IngredientsQuerySchema, IngredientIdParamSchema,
  IngredientCreateSchema, IngredientUpdateSchema, StockAdjustSchema,
  PurchaseOrderQuerySchema, PurchaseOrderCreateSchema, PurchaseOrderUpdateSchema, PurchaseOrderReceiveSchema,
  WastageQuerySchema, WastageCreateSchema, RecipeUpsertSchema
} from './inventory.schema';
import {
  handleGetSummary, handleGetIngredients, handleGetIngredientById, handleCreateIngredient,
  handleUpdateIngredient, handleDeleteIngredient, handleAdjustStock,
  handleGetPurchaseOrders, handleCreatePurchaseOrder, handleUpdatePurchaseOrder, handleReceivePurchaseOrder, handleAutoGeneratePO,
  handleGetWastageLogs, handleCreateWastageLog, handleUpsertRecipe, handleGetRecipes
} from './inventory.handlers';

export const inventoryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // SUMMARY
  fastify.get('/api/inventory/summary', {
    schema: { querystring: InventorySummaryQuerySchema },
    preHandler: requireTenant,
  }, handleGetSummary);

  // INGREDIENTS
  fastify.get('/api/inventory/ingredients', {
    schema: { querystring: IngredientsQuerySchema },
    preHandler: requireTenant,
  }, handleGetIngredients);

  fastify.get('/api/inventory/ingredients/:id', {
    schema: { params: IngredientIdParamSchema },
    preHandler: requireTenant,
  }, handleGetIngredientById);

  fastify.post('/api/inventory/ingredients', {
    schema: { body: IngredientCreateSchema, response: { 201: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleCreateIngredient);

  fastify.put('/api/inventory/ingredients/:id', {
    schema: { params: IngredientIdParamSchema, body: IngredientUpdateSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleUpdateIngredient);

  fastify.post('/api/inventory/ingredients/:id/adjust', {
    schema: { params: IngredientIdParamSchema, body: StockAdjustSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleAdjustStock);

  fastify.delete('/api/inventory/ingredients/:id', {
    schema: { params: IngredientIdParamSchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleDeleteIngredient);

  // PURCHASE ORDERS
  fastify.get('/api/inventory/purchase-orders', {
    schema: { querystring: PurchaseOrderQuerySchema },
    preHandler: requireTenant,
  }, handleGetPurchaseOrders);

  fastify.post('/api/inventory/purchase-orders', {
    schema: { body: PurchaseOrderCreateSchema, response: { 201: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleCreatePurchaseOrder);

  fastify.post('/api/inventory/purchase-orders/auto', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleAutoGeneratePO);

  fastify.put('/api/inventory/purchase-orders/:id', {
    schema: { params: IngredientIdParamSchema, body: PurchaseOrderUpdateSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleUpdatePurchaseOrder);

  fastify.put('/api/inventory/purchase-orders/:id/receive', {
    schema: { params: IngredientIdParamSchema, body: PurchaseOrderReceiveSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleReceivePurchaseOrder);

  // WASTAGE LOG
  fastify.get('/api/inventory/wastage', {
    schema: { querystring: WastageQuerySchema },
    preHandler: requireTenant,
  }, handleGetWastageLogs);

  fastify.post('/api/inventory/wastage', {
    schema: { body: WastageCreateSchema, response: { 201: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleCreateWastageLog);

  // RECIPES
  fastify.get('/api/inventory/recipes', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleGetRecipes);

  fastify.post('/api/inventory/recipes', {
    schema: { body: RecipeUpsertSchema, response: { 200: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleUpsertRecipe);
};
