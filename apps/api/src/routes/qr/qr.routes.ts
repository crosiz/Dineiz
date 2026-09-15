import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { getQrSettings, updateQrSettings, createQrOrder, getGuestMenu } from './qr.handlers';

const qrRoutes: FastifyPluginAsync = async (fastify) => {

  // Public endpoints for customers
  fastify.get('/menu', getGuestMenu);
  fastify.post('/orders', createQrOrder);

  // Authenticated endpoints for Dashboard
  fastify.register(async (authRoutes) => {
    authRoutes.addHook('preHandler', requireAuth);
    authRoutes.get('/settings', getQrSettings);
    authRoutes.put('/settings', updateQrSettings);
  });
};

export default qrRoutes;
