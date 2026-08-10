import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireTenant } from '../../middleware/auth';
import { z } from 'zod';

const StripeIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('pkr'),
});

const JazzCashInitSchema = z.object({
  amount: z.number().positive(),
  orderRef: z.string().min(1),
});

export const paymentsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Stripe intent scaffold
  fastify.post('/api/payments/stripe/intent', {
    schema: { body: StripeIntentSchema },
    preHandler: requireTenant,
  }, async (request, reply) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return reply.status(501).send({ error: 'Stripe not configured' });
    }
    return { ok: true, note: 'Stripe intent scaffold. Add stripe SDK + createPaymentIntent.' };
  });

  // JazzCash init scaffold
  fastify.post('/api/payments/jazzcash/init', {
    schema: { body: JazzCashInitSchema },
    preHandler: requireTenant,
  }, async (request, reply) => {
    if (!process.env.JAZZCASH_MERCHANT_ID) {
      return reply.status(501).send({ error: 'JazzCash not configured' });
    }
    return { ok: true, note: 'JazzCash init scaffold. Add signed request flow.' };
  });
};
