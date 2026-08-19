import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireTenant, requireRole } from '../../middleware/auth';
import { StaffHandlers } from './staff.handlers';
import { StaffQuerySchema, CreateStaffSchema, UpdateStaffSchema, ResetPinSchema } from './staff.schema';

// Staff create/update/delete/PIN-reset are TENANT_ADMIN-only actions in the
// dashboard UI (Staff & Roles isn't in BRANCH_MANAGER_NAV) — these mutating
// routes previously only checked requireTenant, which any authenticated
// BRANCH_MANAGER satisfies, so a branch manager could call them directly
// and create staff, change roles, reset PINs, or delete staff regardless
// of what the UI shows them.
const STAFF_ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];

export const staffRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/staff/summary', {
    preHandler: requireTenant,
  }, StaffHandlers.getSummary);

  fastify.get('/api/staff', {
    preHandler: requireTenant,
  }, StaffHandlers.getStaffList);

  fastify.post('/api/staff', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.createStaff);

  fastify.put('/api/staff/:id', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.updateStaff);

  fastify.put('/api/staff/:id/toggle-status', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.toggleStatus);

  fastify.put('/api/staff/:id/reset-pin', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.resetPin);

  fastify.put('/api/staff/:id/resend-invite', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.resendInvite);

  fastify.delete('/api/staff/:id', {
    preHandler: requireRole(STAFF_ADMIN_ROLES),
  }, StaffHandlers.deleteStaff);
}
