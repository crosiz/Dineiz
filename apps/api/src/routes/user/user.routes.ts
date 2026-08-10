import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma, Role } from '@dineiz/db';
import { requireRole } from '../../middleware/auth';
import { z } from 'zod';

import crypto from 'crypto';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  password: z.string().min(8).optional(),
  role: z.nativeEnum(Role),
  branchId: z.string().optional(),
  posPin: z.string().min(4).max(6).optional(),
});

export const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/users', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const users = await prisma.user.findMany({ 
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, branchId: true }
    });
    return users;
  });

  fastify.post('/api/users', {
    schema: { body: createUserSchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN'])
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const data = (request.body as any);
    
    // PIN Logic requirements
    const posRoles = ['CASHIER', 'WAITER'];
    const adminRoles = ['TENANT_ADMIN', 'SUPER_ADMIN'];

    if (posRoles.includes(data.role) && !data.posPin) {
      return reply.status(400).send({ error: `A PIN is required for the ${data.role} role.` });
    }

    let hashedPin: string | null = null;
    if (adminRoles.includes(data.role)) {
      hashedPin = null; // Admins must not have a PIN
    } else if (data.posPin) {
      hashedPin = hashPin(data.posPin);
    }

    // Note: Password hashing should be done properly via better-auth in real implementation
    // Using a placeholder password if not provided for pos-only roles
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        branchId: data.branchId,
        posPin: hashedPin,
        tenantId,
        emailVerified: true
      }
    });
    return reply.status(201).send({ id: user.id, email: user.email });
  });
};


