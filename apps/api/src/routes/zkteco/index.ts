import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { zktecoRoutes } from './zkteco.routes';

export const zkteco: FastifyPluginAsyncZod = async (fastify) => {
  await fastify.register(zktecoRoutes, { prefix: '/api/zkteco/devices' });
};
