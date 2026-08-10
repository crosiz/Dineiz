import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import {
  KdsQueueQuerySchema, KdsHistoryQuerySchema, KdsStatsQuerySchema,
  KdsOrderParamSchema, KdsItemParamSchema, KdsBranchBodySchema, KdsCancelBodySchema,
} from './kds.schema';
import {
  handleGetKdsDashboard, handleGetHistory, handleGetStats,
  handleMarkItemReady,
  handleStartOrder, handleBumpOrder, handleRecallOrder, handleDeliverOrder, handleCancelOrder,
} from './kds.handlers';

export const kdsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const staffRoles = ['CASHIER', 'KITCHEN_STAFF', 'BRANCH_MANAGER', 'TENANT_ADMIN'] as const;

  // ── Main KDS dashboard endpoint ───────────────────────────────────────────
  fastify.get('/api/kds/orders', {
    preHandler: requireRole([...staffRoles]),
  }, handleGetKdsDashboard);

  // ── Order history ─────────────────────────────────────────────────────────
  fastify.get('/api/kds/orders/history', {
    preHandler: requireRole([...staffRoles]),
  }, handleGetHistory);

  // ── Stats ─────────────────────────────────────────────────────────────────
  fastify.get('/api/kds/stats', {
    preHandler: requireRole(['KITCHEN_STAFF', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, handleGetStats);

  // ── Per-item ready ────────────────────────────────────────────────────────
  fastify.patch('/api/kds/items/:itemId/ready', {
    preHandler: requireRole([...staffRoles]),
  }, handleMarkItemReady);

  // ── Order lifecycle ───────────────────────────────────────────────────────
  fastify.patch('/api/kds/orders/:id/start', {
    preHandler: requireRole([...staffRoles]),
  }, handleStartOrder);

  fastify.patch('/api/kds/orders/:id/bump', {
    preHandler: requireRole([...staffRoles]),
  }, handleBumpOrder);

  fastify.patch('/api/kds/orders/:id/recall', {
    preHandler: requireRole(['KITCHEN_STAFF', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, handleRecallOrder);

  fastify.patch('/api/kds/orders/:id/deliver', {
    preHandler: requireRole(['CASHIER', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, handleDeliverOrder);

  fastify.patch('/api/kds/orders/:id/cancel', {
    preHandler: requireRole(['BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, handleCancelOrder);
};
