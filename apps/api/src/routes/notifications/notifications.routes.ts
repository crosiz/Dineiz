import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { requireTenant } from '../../middleware/auth';
import { z } from 'zod';

const RegisterDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.string().optional(),
});

export const notificationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post('/api/notifications/devices', {
    preHandler: requireTenant,
  }, async (request, reply) => {
    const parsed = RegisterDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parsed.error.issues });
    }
    const userId = request.user!.id;
    const { token, platform } = parsed.data;

    await prisma.userDevice.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });

    return { success: true };
  });

  fastify.get('/api/notifications/unread', {
    preHandler: requireTenant,
  }, async (_request, _reply) => {
    // Return a dummy count of 0 for now since there's no Notification model
    return { count: 0 };
  });
};



