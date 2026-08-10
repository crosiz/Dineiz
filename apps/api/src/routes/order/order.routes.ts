import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { OrderCreateSchema, OrderUpdateSchema, OrderListQuerySchema, OrderLiveQuerySchema, OrderHistoryQuerySchema, OrderIdParamSchema, OrderAssignSchema, OrderItemsAppendSchema, OrderItemDeleteParamSchema, OrderItemDeleteBodySchema } from './order.schema';
import {
  handleCreateOrder, handleListOrders, handleListOrderHistory, handleListLiveOrders, handleGetOrder, handleUpdateOrder, handleGetActiveCount, handleAssignOrder, handleAppendOrderItems, handleDeleteOrderItem, handleListActiveOrders
} from './order.handlers';

export const orderRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/orders/active-count', {
    preHandler: requireTenant,
  }, handleGetActiveCount);

  fastify.get('/api/orders/active', {
    preHandler: requireTenant,
  }, handleListActiveOrders);

  fastify.post('/api/orders', {
    schema: { body: OrderCreateSchema },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, handleCreateOrder);

  fastify.get('/api/orders', {
    schema: { querystring: OrderListQuerySchema },
    preHandler: requireTenant,
  }, handleListOrders);

  fastify.get('/api/orders/history', {
    schema: { querystring: OrderHistoryQuerySchema },
    preHandler: requireTenant,
  }, handleListOrderHistory);

  fastify.get('/api/orders/live', {
    schema: { querystring: OrderLiveQuerySchema },
    preHandler: requireTenant,
  }, handleListLiveOrders);

  fastify.get('/api/orders/:id', {
    schema: { params: OrderIdParamSchema },
    preHandler: requireTenant,
  }, handleGetOrder);

  fastify.put('/api/orders/:id', {
    schema: { params: OrderIdParamSchema, body: OrderUpdateSchema },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, handleUpdateOrder);

  fastify.post('/api/orders/:id/items', {
    schema: { params: OrderIdParamSchema, body: OrderItemsAppendSchema },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, handleAppendOrderItems);

  fastify.put('/api/orders/:id/assign', {
    schema: { params: OrderIdParamSchema, body: OrderAssignSchema },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, handleAssignOrder);

  fastify.delete('/api/orders/:id/items/:itemId', {
    schema: { params: OrderItemDeleteParamSchema, body: OrderItemDeleteBodySchema },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, handleDeleteOrderItem);
};
