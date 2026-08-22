import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import {
  InventorySummaryQuerySchema, IngredientsQuerySchema, IngredientIdParamSchema,
  IngredientCreateSchema, IngredientUpdateSchema, StockAdjustSchema, StockHistoryQuerySchema,
  CostImpactPreviewSchema, ImportCsvSchema,
  SupplierCreateSchema, SupplierUpdateSchema,
  PurchaseOrderQuerySchema, PurchaseOrderCreateSchema, PurchaseOrderUpdateSchema, PurchaseOrderReceiveSchema,
  WastageQuerySchema, WastageCreateSchema, WastageAnalyticsQuerySchema,
  RecipeUpsertSchema, RecipeCopySchema,
} from './inventory.schema';
import {
  handleGetSummary,
  handleGetSuppliers, handleCreateSupplier, handleUpdateSupplier, handleDeleteSupplier,
  handleGetIngredients, handleGetIngredientById, handleGetIngredientUsage, handleCreateIngredient,
  handleUpdateIngredient, handleDeleteIngredient, handleImportIngredientsCsv, handlePreviewCostImpact,
  handleAdjustStock, handleGetStockHistory, handleGetLowStockCount, handleGetStockValuation,
  handleGetPurchaseOrders, handleGetPurchaseOrderById, handleCreatePurchaseOrder, handleUpdatePurchaseOrder,
  handleSendPurchaseOrder, handleCancelPurchaseOrder, handleReceivePurchaseOrder, handleAutoGeneratePO,
  handleGetWastageLogs, handleCreateWastageLog, handleGetWastageAnalytics,
  handleGetRecipes, handleGetRecipeForItem, handleUpsertRecipe, handleDeleteRecipe, handleCopyRecipe, handleFoodCostReport,
} from './inventory.handlers';

const MANAGE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'];

export const inventoryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // SUMMARY
  fastify.get('/api/inventory/summary', { schema: { querystring: InventorySummaryQuerySchema }, preHandler: requireTenant }, handleGetSummary);

  // SUPPLIERS
  fastify.get('/api/inventory/suppliers', { preHandler: requireTenant }, handleGetSuppliers);
  fastify.post('/api/inventory/suppliers', { schema: { body: SupplierCreateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCreateSupplier);
  fastify.put('/api/inventory/suppliers/:id', { schema: { params: IngredientIdParamSchema, body: SupplierUpdateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleUpdateSupplier);
  fastify.delete('/api/inventory/suppliers/:id', { schema: { params: IngredientIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleDeleteSupplier);

  // INGREDIENTS
  fastify.get('/api/inventory/ingredients', { schema: { querystring: IngredientsQuerySchema }, preHandler: requireTenant }, handleGetIngredients);
  fastify.get('/api/inventory/ingredients/:id', { schema: { params: IngredientIdParamSchema }, preHandler: requireTenant }, handleGetIngredientById);
  fastify.get('/api/inventory/ingredients/:id/usage', { schema: { params: IngredientIdParamSchema }, preHandler: requireTenant }, handleGetIngredientUsage);
  fastify.post('/api/inventory/ingredients', { schema: { body: IngredientCreateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCreateIngredient);
  fastify.put('/api/inventory/ingredients/:id', { schema: { params: IngredientIdParamSchema, body: IngredientUpdateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleUpdateIngredient);
  fastify.post('/api/inventory/ingredients/:id/adjust', { schema: { params: IngredientIdParamSchema, body: StockAdjustSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleAdjustStock);
  fastify.delete('/api/inventory/ingredients/:id', { schema: { params: IngredientIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleDeleteIngredient);
  fastify.post('/api/inventory/ingredients/import', { schema: { body: ImportCsvSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleImportIngredientsCsv);
  fastify.post('/api/inventory/ingredients/:id/cost-impact-preview', { schema: { params: IngredientIdParamSchema, body: CostImpactPreviewSchema }, preHandler: requireRole(MANAGE_ROLES) }, handlePreviewCostImpact);

  // STOCK
  fastify.get('/api/inventory/stock/:id/history', { schema: { params: IngredientIdParamSchema, querystring: StockHistoryQuerySchema }, preHandler: requireTenant }, handleGetStockHistory);
  fastify.get('/api/inventory/stock/low-count', { preHandler: requireTenant }, handleGetLowStockCount);
  fastify.get('/api/inventory/stock/valuation', { preHandler: requireTenant }, handleGetStockValuation);

  // PURCHASE ORDERS
  fastify.get('/api/inventory/purchase-orders', { schema: { querystring: PurchaseOrderQuerySchema }, preHandler: requireTenant }, handleGetPurchaseOrders);
  fastify.get('/api/inventory/purchase-orders/:id', { schema: { params: IngredientIdParamSchema }, preHandler: requireTenant }, handleGetPurchaseOrderById);
  fastify.post('/api/inventory/purchase-orders', { schema: { body: PurchaseOrderCreateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCreatePurchaseOrder);
  fastify.post('/api/inventory/purchase-orders/auto', { preHandler: requireRole(MANAGE_ROLES) }, handleAutoGeneratePO);
  fastify.put('/api/inventory/purchase-orders/:id', { schema: { params: IngredientIdParamSchema, body: PurchaseOrderUpdateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleUpdatePurchaseOrder);
  fastify.post('/api/inventory/purchase-orders/:id/send', { schema: { params: IngredientIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleSendPurchaseOrder);
  fastify.post('/api/inventory/purchase-orders/:id/cancel', { schema: { params: IngredientIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCancelPurchaseOrder);
  fastify.put('/api/inventory/purchase-orders/:id/receive', { schema: { params: IngredientIdParamSchema, body: PurchaseOrderReceiveSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleReceivePurchaseOrder);
  fastify.post('/api/inventory/purchase-orders/:id/receive', { schema: { params: IngredientIdParamSchema, body: PurchaseOrderReceiveSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleReceivePurchaseOrder);

  // WASTAGE LOG
  fastify.get('/api/inventory/wastage', { schema: { querystring: WastageQuerySchema }, preHandler: requireTenant }, handleGetWastageLogs);
  fastify.post('/api/inventory/wastage', { schema: { body: WastageCreateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCreateWastageLog);
  fastify.get('/api/inventory/wastage/analytics', { schema: { querystring: WastageAnalyticsQuerySchema }, preHandler: requireTenant }, handleGetWastageAnalytics);

  // RECIPES
  fastify.get('/api/inventory/recipes', { preHandler: requireRole(MANAGE_ROLES) }, handleGetRecipes);
  fastify.get('/api/inventory/recipes/food-cost-report', { preHandler: requireRole(MANAGE_ROLES) }, handleFoodCostReport);
  fastify.get('/api/inventory/recipes/:itemId', { preHandler: requireRole(MANAGE_ROLES) }, handleGetRecipeForItem);
  fastify.put('/api/inventory/recipes/:itemId', { preHandler: requireRole(MANAGE_ROLES) }, handleUpsertRecipe);
  fastify.post('/api/inventory/recipes', { schema: { body: RecipeUpsertSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleUpsertRecipe);
  fastify.delete('/api/inventory/recipes/:itemId', { preHandler: requireRole(MANAGE_ROLES) }, handleDeleteRecipe);
  fastify.post('/api/inventory/recipes/copy', { schema: { body: RecipeCopySchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCopyRecipe);
};
