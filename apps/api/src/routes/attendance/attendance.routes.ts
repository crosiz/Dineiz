import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { processPunch } from '../../services/attendance.service';
import { manualPunchSchema, getAttendanceSchema } from './attendance.schema';

export const attendanceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const { requireAuth } = await import('../../middleware/auth.js');
    await requireAuth(request as any, reply);
  });

  fastify.get('/', { schema: { querystring: getAttendanceSchema } }, async (request, reply) => {
    const { tenantId } = (request as any).user;
    const { branchId, dateFrom, dateTo, staffId, page = '1', limit = '10' } = request.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };
    if (branchId) where.branchId = branchId;
    if (staffId) where.userId = staffId;
    if (dateFrom && dateTo) {
      where.punchTime = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }

    const [punches, total] = await Promise.all([
      prisma.attendancePunch.findMany({
        where,
        include: { user: true, device: true },
        orderBy: { punchTime: 'desc' },
        skip,
        take
      }),
      prisma.attendancePunch.count({ where })
    ]);

    return { punches, total, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.post('/manual-punch', { schema: { body: manualPunchSchema } }, async (request, reply) => {
    const { tenantId } = (request as any).user;
    const body = request.body as any;

    const staff = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!staff) return reply.code(404).send({ error: 'User Not Found' });

    // Trigger process punch with 'MANUAL' method indicator.
    // The attendance.service needs to handle this specifically.
    await processPunch({
      userId: body.userId,
      punchTime: new Date(),
      punchType: body.punchType,
      deviceId: 'MANUAL',
      tenantId,
      branchId: body.branchId
    }, 'MANUAL');

    return { success: true };
  });
};
