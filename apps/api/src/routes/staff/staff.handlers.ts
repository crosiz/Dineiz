import { FastifyRequest, FastifyReply } from 'fastify';
import { StaffService } from './staff.service';
import { StaffQuery, CreateStaff, UpdateStaff, ResetPin, StaffQuerySchema, CreateStaffSchema, UpdateStaffSchema, ResetPinSchema } from './staff.schema';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';

export class StaffHandlers {
  static async getSummary(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = z.object({ branchId: z.string().optional() }).safeParse(req.query);
    const branchId = parsed.success ? parsed.data.branchId : undefined;

    try {
      const summary = await StaffService.getSummary(tenantId, branchId);
      return reply.send(summary);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  static async getStaffList(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = StaffQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }

    try {
      const data = await StaffService.getStaffList(tenantId, parsed.data);
      return reply.send(data);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  static async createStaff(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = CreateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }
    const body = parsed.data;

    // Auto-generate email for POS staff if omitted
    if (!body.email) {
      body.email = `staff_${Math.random().toString(36).substring(2, 10)}@dineiz.local`;
    }

    // Role-based security rules
    if (user.role === 'BRANCH_MANAGER') {
      if (body.branchId !== user.branchId) {
        return reply.status(403).send({ error: 'Cannot create staff for other branches' });
      }
      if (['BRANCH_MANAGER', 'TENANT_ADMIN'].includes(body.role)) {
        return reply.status(403).send({ error: 'You cannot create managers or admins' });
      }
    }

    // PIN validation
    if (['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER'].includes(body.role)) {
      if (!body.posPin || body.posPin.length !== 4 || !/^\d{4}$/.test(body.posPin)) {
        return reply.status(400).send({ error: 'A 4-digit PIN is required for this role' });
      }
      body.posPin = crypto.createHash('sha256').update(body.posPin).digest('hex');
    }
    
    if (body.role === 'BRANCH_MANAGER') {
      if (!body.password || body.password.length < 8) {
        return reply.status(400).send({ error: 'Password required for branch managers (min 8 chars)' });
      }
      // Password handled upstream or by better-auth, for now just create user without password in user table.
    }

    try {
      const newStaff = await StaffService.createStaff(user.tenantId, body);
      return reply.status(201).send(newStaff);
    } catch (error: any) {
      if (error.isLimitError) {
        const { isLimitError, ...limitBody } = error;
        return reply.status(402).send(limitBody);
      }
      req.log.error(error);
      if (error.message === 'This email is already registered') {
        return reply.status(409).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  }

  static async updateStaff(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsedParams = z.object({ id: z.string() }).safeParse(req.params);
    const parsedBody = UpdateStaffSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({ error: 'Bad Request' });
    }

    try {
      const updated = await StaffService.updateStaff(user.tenantId, parsedParams.data.id, parsedBody.data);
      return reply.send(updated);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  static async toggleStatus(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsedParams = z.object({ id: z.string() }).safeParse(req.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Bad Request' });

    try {
      const updated = await StaffService.toggleStatus(user.tenantId, parsedParams.data.id);
      return reply.send(updated);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  static async resendInvite(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsedParams = z.object({ id: z.string() }).safeParse(req.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Bad Request' });

    try {
      const result = await StaffService.resendInvite(user.tenantId, parsedParams.data.id);
      return reply.send(result);
    } catch (error: any) {
      req.log.error(error);
      if (error.message === 'Staff member not found') {
        return reply.status(404).send({ error: error.message });
      }
      if (error.message.includes('no email') || error.message.includes('only available')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  }

  static async resetPin(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsedParams = z.object({ id: z.string() }).safeParse(req.params);
    const parsedBody = ResetPinSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) return reply.status(400).send({ error: 'Bad Request' });

    try {
      const hashedPin = crypto.createHash('sha256').update(parsedBody.data.newPin).digest('hex');
      const updated = await StaffService.resetPin(user.tenantId, parsedParams.data.id, hashedPin);
      return reply.send(updated);
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }

  static async deleteStaff(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user;
    if (!user || !user.tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    if (user.role !== 'TENANT_ADMIN') {
      return reply.status(403).send({ error: 'Only Tenant Admins can delete staff' });
    }

    const parsedParams = z.object({ id: z.string() }).safeParse(req.params);
    if (!parsedParams.success) return reply.status(400).send({ error: 'Bad Request' });

    try {
      await StaffService.deleteStaff(user.tenantId, parsedParams.data.id);
      return reply.status(204).send();
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  }
}
