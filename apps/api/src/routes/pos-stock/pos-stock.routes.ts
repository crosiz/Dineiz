import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { handleGetStockStatus, handleQuickAdjust, handleNotifyManager } from './pos-stock.handlers';

const StockStatusQuerySchema = z.object({ branchId: z.string().optional() });
const QuickAdjustSchema = z.object({ branchId: z.string().optional(), ingredientId: z.string().min(1), quantity: z.number().min(0), reason: z.string().min(1) });
const NotifyManagerSchema = z.object({ branchId: z.string().optional(), ingredientId: z.string().min(1) });

export const posStockRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/pos/stock-status', { schema: { querystring: StockStatusQuerySchema }, preHandler: requireAuth }, handleGetStockStatus);
  fastify.post('/api/pos/stock/quick-adjust', { schema: { body: QuickAdjustSchema }, preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleQuickAdjust);
  fastify.post('/api/pos/stock/notify-manager', { schema: { body: NotifyManagerSchema }, preHandler: requireAuth }, handleNotifyManager);
};
