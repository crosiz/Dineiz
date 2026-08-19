import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { WhatsAppConfigUpdateSchema, WhatsAppConversationsQuerySchema } from './whatsapp.schema';
import {
  handleWebhookVerify,
  handleWebhook,
  handleGetConfig,
  handleUpdateConfig,
  handleListConversations,
} from './whatsapp.handlers';

export const whatsappRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Capture the raw request body so the webhook handler can verify Meta's
  // X-Hub-Signature-256 HMAC — plugin-scoped, so this doesn't affect JSON
  // parsing anywhere else in the app.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    (_req as any).rawBody = body;
    try {
      done(null, body.length ? JSON.parse(body.toString('utf8')) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Public — Meta calls these directly, no session.
  fastify.get('/api/whatsapp/webhook', handleWebhookVerify);
  fastify.post('/api/whatsapp/webhook', handleWebhook);

  fastify.get('/api/whatsapp/config', {
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, handleGetConfig);

  fastify.put('/api/whatsapp/config', {
    schema: { body: WhatsAppConfigUpdateSchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']),
  }, handleUpdateConfig);

  fastify.get('/api/whatsapp/conversations', {
    schema: { querystring: WhatsAppConversationsQuerySchema },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, handleListConversations);
};
