import { FastifyPluginAsync } from 'fastify';
import { requireAuth, resolveBranchId } from '../../middleware/auth';
import * as inventoryService from './inventory.service';

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  const branchScoped = (fn: (branchId: string) => Promise<unknown>) =>
    async (request: any, reply: any) => {
      const branchId = resolveBranchId(request);
      if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
      return fn(branchId);
    };

  fastify.get('/api/inventory/stock', { preHandler: requireAuth }, branchScoped(inventoryService.listStock));
  fastify.get('/api/inventory/ingredients', { preHandler: requireAuth }, branchScoped(inventoryService.listIngredients));
  fastify.get('/api/inventory/recipes', { preHandler: requireAuth }, branchScoped(inventoryService.listRecipes));
  fastify.get('/api/inventory/purchase-orders', { preHandler: requireAuth }, branchScoped(inventoryService.listPurchaseOrders));
  fastify.get('/api/inventory/goods-receipts', { preHandler: requireAuth }, branchScoped(inventoryService.listGoodsReceipts));
  fastify.get('/api/inventory/wastage', { preHandler: requireAuth }, branchScoped(inventoryService.listWastage));
  fastify.get('/api/inventory/stock-checks', { preHandler: requireAuth }, branchScoped(inventoryService.listStockChecks));
  fastify.get('/api/inventory/movements', { preHandler: requireAuth }, branchScoped(inventoryService.listMovements));
};
