import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import {
  listCustomersHandler,
  getCustomerHandler,
  lookupCustomerHandler,
  createCustomerHandler,
  updateCustomerHandler,
  deleteCustomerHandler,
  addNoteHandler,
} from './customers.handlers';
import {
  CustomerQuerySchema,
  CustomerLookupSchema,
  CustomerCreateSchema,
  CustomerUpdateSchema,
  AddNoteSchema,
  CustomerOrdersQuerySchema,
  CustomerLoyaltyQuerySchema,
  AdjustPointsSchema,
  CustomerImportSchema,
} from './customers.schema';

import {
  getCustomerOrdersHandler,
  getCustomerLoyaltyHandler,
  adjustPointsHandler,
  importCustomersHandler,
} from './customers.handlers';

export const customerRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const authRole = requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']);

  fastify.get('/', {
    preHandler: authRole,
    schema: { querystring: CustomerQuerySchema }
  }, listCustomersHandler);

  fastify.get('/lookup', {
    preHandler: authRole,
    schema: { querystring: CustomerLookupSchema }
  }, lookupCustomerHandler);

  fastify.post('/import', {
    preHandler: authRole,
    schema: { body: CustomerImportSchema }
  }, importCustomersHandler);

  fastify.get('/:id', { preHandler: authRole }, getCustomerHandler);

  fastify.get('/:id/orders', {
    preHandler: authRole,
    schema: { querystring: CustomerOrdersQuerySchema }
  }, getCustomerOrdersHandler);

  fastify.get('/:id/loyalty', {
    preHandler: authRole,
    schema: { querystring: CustomerLoyaltyQuerySchema }
  }, getCustomerLoyaltyHandler);

  fastify.post('/', {
    preHandler: authRole,
    schema: { body: CustomerCreateSchema }
  }, createCustomerHandler);

  fastify.put('/:id', {
    preHandler: authRole,
    schema: { body: CustomerUpdateSchema }
  }, updateCustomerHandler);

  fastify.delete('/:id', { preHandler: authRole }, deleteCustomerHandler);

  fastify.post('/:id/notes', {
    preHandler: authRole,
    schema: { body: AddNoteSchema }
  }, addNoteHandler);

  fastify.post('/:id/points/adjust', {
    preHandler: authRole,
    schema: { body: AdjustPointsSchema }
  }, adjustPointsHandler);
};
