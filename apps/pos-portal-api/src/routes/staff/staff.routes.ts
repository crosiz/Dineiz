import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole, resolveBranchId } from '../../middleware/auth';
import * as staffService from './staff.service';

const CreateStaffSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF']),
});

export const staffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/staff', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return staffService.listStaff(branchId);
  });

  fastify.post('/api/staff', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']) }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId || !request.user?.tenantId) return reply.status(400).send({ error: 'No branch in scope' });
    const parsed = CreateStaffSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    const staff = await staffService.createStaffMember(request.user.tenantId, branchId, parsed.data);
    return reply.status(201).send(staff);
  });

  // Scoped to the same roles as create: this endpoint's only real caller is
  // Onboarding's "undo a staff member I just added by mistake" button, not a
  // general staff-management delete (Staff Management has no delete UI) —
  // whoever can create here should be able to correct their own mistake.
  fastify.delete('/api/staff/:id', { preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']) }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    const { id } = request.params as { id: string };
    const deleted = await staffService.deleteStaffMember(branchId, id);
    if (!deleted) return reply.status(404).send({ error: 'Staff member not found' });
    return reply.status(204).send();
  });

  fastify.get('/api/staff/permissions', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user?.tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { role } = request.query as { role?: string };
    return staffService.listPermissions(request.user.tenantId, role ?? 'BRANCH_MANAGER');
  });

  fastify.get('/api/staff/attendance', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return staffService.listAttendance(branchId);
  });

  fastify.get('/api/staff/payroll', { preHandler: requireAuth }, async (request, reply) => {
    const branchId = await resolveBranchId(request);
    if (!branchId) return reply.status(400).send({ error: 'No branch in scope' });
    return staffService.listPayroll(branchId);
  });
};
