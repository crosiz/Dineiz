import { FastifyInstance } from 'fastify';
import {
  getRidersHandler,
  assignOrderHandler,
  updateRiderLocationHandler,
  updateDeliveryStageHandler,
  getUnassignedOrdersHandler,
  handleListDeliveries,
  handleListRiders,
  handleCreateRider,
  handleAssignRider,
  handleUpdateDeliveryStatus,
} from './fleet.handlers';

import { requireRole } from '../../middleware/auth';

export async function fleetRoutes(fastify: FastifyInstance) {
  fastify.get('/api/fleet/riders', getRidersHandler);
  fastify.post('/api/fleet/assign', assignOrderHandler);
  fastify.put('/api/fleet/riders/:id/location', updateRiderLocationHandler);
  fastify.put('/api/fleet/riders/:id/stage', updateDeliveryStageHandler);
  fastify.get('/api/fleet/unassigned-orders', getUnassignedOrdersHandler);

  // Web Dashboard endpoints
  fastify.get('/api/fleet/deliveries', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleListDeliveries);
  fastify.get('/api/fleet/riders/dashboard', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleListRiders);
  fastify.post('/api/fleet/riders', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']) }, handleCreateRider);
  fastify.put('/api/fleet/deliveries/:orderId/assign', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleAssignRider);
  fastify.put('/api/fleet/deliveries/:orderId/status', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']) }, handleUpdateDeliveryStatus);
}
