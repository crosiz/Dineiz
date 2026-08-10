import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { attendanceRoutes } from './attendance.routes';

export const attendance: FastifyPluginAsyncZod = async (fastify) => {
  await fastify.register(attendanceRoutes, { prefix: '/api/attendance' });
};
