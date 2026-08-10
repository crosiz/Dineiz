import { FastifyPluginAsync } from 'fastify';
import { requireTenant } from '../../middleware/auth';
import * as handlers from './webhooks.handlers';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireTenant);

  fastify.get('/', handlers.listWebhooks);
  fastify.post('/', handlers.createWebhook);
  fastify.put('/:id', handlers.updateWebhook);
  fastify.delete('/:id', handlers.deleteWebhook);
  
  fastify.get('/:id/deliveries', handlers.getWebhookDeliveries);
  fastify.post('/:id/test', handlers.testWebhook);
  fastify.post('/deliveries/:deliveryId/retry', handlers.retryDelivery);
};

export default webhooksRoutes;
