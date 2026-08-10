import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireTenant } from '../../middleware/auth';
import { StaffHandlers } from './staff.handlers';
import { StaffQuerySchema, CreateStaffSchema, UpdateStaffSchema, ResetPinSchema } from './staff.schema';

export const staffRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/staff/summary', {
    preHandler: requireTenant,
  }, StaffHandlers.getSummary);

  fastify.get('/api/staff', {
    preHandler: requireTenant,
  }, StaffHandlers.getStaffList);

  fastify.post('/api/staff', {
    preHandler: requireTenant,
  }, StaffHandlers.createStaff);

  fastify.put('/api/staff/:id', {
    preHandler: requireTenant,
  }, StaffHandlers.updateStaff);

  fastify.put('/api/staff/:id/toggle-status', {
    preHandler: requireTenant,
  }, StaffHandlers.toggleStatus);

  fastify.put('/api/staff/:id/reset-pin', {
    preHandler: requireTenant,
  }, StaffHandlers.resetPin);

  fastify.delete('/api/staff/:id', {
    preHandler: requireTenant,
  }, StaffHandlers.deleteStaff);
}
