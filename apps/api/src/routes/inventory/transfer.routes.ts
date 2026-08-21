import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { TransferQuerySchema, TransferIdParamSchema, TransferCreateSchema, TransferDispatchSchema, TransferReceiveSchema } from './transfer.schema';
import {
  handleGetTransfers, handleGetTransferById, handleCreateTransfer,
  handleDispatchTransfer, handleReceiveTransfer, handleCancelTransfer,
} from './transfer.handlers';

const MANAGE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'];

export const transferRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/inventory/transfers', { schema: { querystring: TransferQuerySchema }, preHandler: requireTenant }, handleGetTransfers);
  fastify.get('/api/inventory/transfers/:id', { schema: { params: TransferIdParamSchema }, preHandler: requireTenant }, handleGetTransferById);
  fastify.post('/api/inventory/transfers', { schema: { body: TransferCreateSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCreateTransfer);
  fastify.post('/api/inventory/transfers/:id/dispatch', { schema: { params: TransferIdParamSchema, body: TransferDispatchSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleDispatchTransfer);
  fastify.post('/api/inventory/transfers/:id/receive', { schema: { params: TransferIdParamSchema, body: TransferReceiveSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleReceiveTransfer);
  fastify.post('/api/inventory/transfers/:id/cancel', { schema: { params: TransferIdParamSchema }, preHandler: requireRole(MANAGE_ROLES) }, handleCancelTransfer);
};
