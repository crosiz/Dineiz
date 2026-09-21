import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { FastifySchemaCompiler } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { env } from './env';
import { prisma } from '@dineiz/pos-portal-db';
import { authRoutes } from './routes/auth/auth.routes';
import { pinRoutes } from './routes/auth/pin.routes';
import { meRoutes } from './routes/auth/me.routes';
import { branchRoutes } from './routes/branch/branch.routes';
import { menuRoutes } from './routes/menu/menu.routes';
import { tableRoutes } from './routes/tables/tables.routes';
import { orderRoutes } from './routes/orders/orders.routes';
import { shiftRoutes } from './routes/shifts/shifts.routes';
import { inventoryRoutes } from './routes/inventory/inventory.routes';
import { warehouseRoutes } from './routes/warehouse/warehouse.routes';
import { deliveryRoutes } from './routes/delivery/delivery.routes';
import { customersRoutes } from './routes/customers/customers.routes';
import { marketingRoutes } from './routes/marketing/marketing.routes';
import { expensesRoutes } from './routes/expenses/expenses.routes';
import { staffRoutes } from './routes/staff/staff.routes';
import { analyticsRoutes } from './routes/analytics/analytics.routes';
import { integrationsRoutes } from './routes/integrations/integrations.routes';
import { settingsRoutes } from './routes/settings/settings.routes';
import { syncQueueRoutes } from './routes/sync-queue/sync-queue.routes';

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Unhandled Rejection:', reason);
});

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

const customValidatorCompiler: FastifySchemaCompiler<any> = ({ schema }) => {
  return (data) => {
    try {
      const result = (schema as ZodTypeAny).safeParse(data);
      if (result.success) return { value: result.data };
      return { error: result.error };
    } catch (err) {
      return { error: err as Error };
    }
  };
};

fastify.setValidatorCompiler(customValidatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

async function build() {
  const allowedOrigins = new Set(env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });

  await fastify.register(authRoutes);
  await fastify.register(pinRoutes);
  await fastify.register(meRoutes);
  await fastify.register(branchRoutes);
  await fastify.register(menuRoutes);
  await fastify.register(tableRoutes);
  await fastify.register(orderRoutes);
  await fastify.register(shiftRoutes);
  await fastify.register(inventoryRoutes);
  await fastify.register(warehouseRoutes);
  await fastify.register(deliveryRoutes);
  await fastify.register(customersRoutes);
  await fastify.register(marketingRoutes);
  await fastify.register(expensesRoutes);
  await fastify.register(staffRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(integrationsRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(syncQueueRoutes);

  fastify.get('/health', async (_request, reply) => {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e: any) {
      fastify.log.error('Health check: database unreachable — ' + e.message);
    }
    return reply.status(dbOk ? 200 : 503).send({
      status: dbOk ? 'ok' : 'error',
      database: dbOk ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    });
  });

  fastify.setErrorHandler((error: Error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message || 'Something went wrong' });
  });

  return fastify;
}

async function start() {
  try {
    const app = await build();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`pos-portal-api started on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
