import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@swiftserve/db';
import { zktecoService } from '../../services/zkteco.service';
import { processPunch } from '../../services/attendance.service';
import { createDeviceSchema, enrollUserSchema } from './zkteco.schema';

export const zktecoRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const { requireAuth } = await import('../../middleware/auth.js');
    await requireAuth(request as any, reply);
  });

  fastify.get('/', async (request) => {
    const { tenantId, branchId } = (request as any).user;
    return await prisma.zktecoDevice.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) }
    });
  });

  fastify.post('/', { schema: { body: createDeviceSchema } }, async (request, reply) => {
    const { tenantId } = (request as any).user;
    const body = request.body;

    const device = await prisma.zktecoDevice.create({
      data: {
        tenantId,
        branchId: body.branchId,
        name: body.name,
        ipAddress: body.ipAddress,
        port: body.port,
        status: 'OFFLINE'
      }
    });

    const connected = await zktecoService.connect({
      ip: device.ipAddress,
      port: device.port,
      timeout: 5000,
      tenantId: device.tenantId,
      branchId: device.branchId,
      deviceId: device.id
    });

    if (connected) {
      await prisma.zktecoDevice.update({ where: { id: device.id }, data: { status: 'ONLINE' } });
      zktecoService.startPolling(device.id, processPunch);
    }

    return { device, connected };
  });

  fastify.post('/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await prisma.zktecoDevice.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Not Found' });

    let connected = await zktecoService.getStatus(device.id) === 'ONLINE';
    if (!connected) {
      connected = await zktecoService.connect({
        ip: device.ipAddress, port: device.port, timeout: 5000,
        tenantId: device.tenantId, branchId: device.branchId, deviceId: device.id
      });
    }

    await prisma.zktecoDevice.update({ where: { id: device.id }, data: { status: connected ? 'ONLINE' : 'OFFLINE' } });
    return { connected };
  });

  fastify.post('/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    await zktecoService.fetchNewPunches(id, processPunch);
    return { success: true };
  });

  fastify.get('/:id/users', async (request, reply) => {
    const { id } = request.params as { id: string };
    const users = await zktecoService.getEnrolledUsers(id);
    return users;
  });

  fastify.post('/:id/enroll', { schema: { body: enrollUserSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body;

    const device = await prisma.zktecoDevice.findUnique({ where: { id } });
    if (!device) return reply.code(404).send({ error: 'Device Not Found' });

    const staff = await prisma.user.findUnique({ where: { id: userId } });
    if (!staff) return reply.code(404).send({ error: 'User Not Found' });

    const existingEnrollments = await prisma.staffZktecoEnrollment.findMany({ where: { deviceId: id } });
    const maxZkId = existingEnrollments.reduce((max, e) => Math.max(max, e.zkUserId), 0);
    const nextZkId = maxZkId + 1;

    try {
      await zktecoService.enrollUser(id, nextZkId, staff.name);
      
      await prisma.staffZktecoEnrollment.create({
        data: {
          userId,
          deviceId: id,
          zkUserId: nextZkId
        }
      });
      return { zkUserId: nextZkId, message: 'Staff enrolled. Ask them to scan their finger on the device.' };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  fastify.delete('/:id/enroll/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string, userId: string };
    await prisma.staffZktecoEnrollment.deleteMany({
      where: { deviceId: id, userId }
    });
    return { success: true };
  });
};
