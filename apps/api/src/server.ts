import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { serializerCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { FastifySchemaCompiler } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { env } from './env';
import { authRoutes, mobileRoutes } from './routes/auth/index';
import { mobileFeatureRoutes } from './routes/mobile/index';
import { tenantRoutes } from './routes/tenant/index';
import { userRoutes } from './routes/user/index';
import { menuRoutes } from './routes/menu/index';
import { orderRoutes, voidRoutes } from './routes/order/index';
import { pinRoutes } from './routes/pin/index';
import { shiftRoutes } from './routes/shift/index';
import { kdsRoutes } from './routes/kds/index';
import { inventoryRoutes } from './routes/inventory/index';
import { dealsRoutes } from './routes/deals/index';
import { notificationRoutes } from './routes/notifications/index';
import { analyticsRoutes } from './routes/analytics/index';
import { aiRoutes } from './routes/ai/index';
import { searchSyncRoutes } from './routes/search-sync/index';
import { crmRoutes } from './routes/crm/index';
import { customerRoutes } from './routes/customers/customers.routes';
import { loyaltyRoutes } from './routes/loyalty/loyalty.routes';
import { rewardsRoutes } from './routes/rewards/index';
import { deliveryRoutes } from './routes/delivery/index';
import { riderRoutes } from './routes/rider/index';
import { paymentsRoutes } from './routes/payments/index';
import { receiptsRoutes } from './routes/receipts/index';
import { aggregatorsRoutes } from './routes/aggregators/index';
import { integrationsRoutes } from './routes/integrations/index';
import { floorPlanRoutes } from './routes/floor-plan/index';
import { tenantDashboardRoutes } from './routes/tenant-dashboard/index';
import { staffRoutes } from './routes/staff/index';
import { fleetRoutes } from './routes/fleet/index';
import { branchesRoutes } from './routes/branches/index';
import { settingsRoutes } from './routes/settings/index';
import { billingRoutes } from './routes/billing/index';
import { zktecoRoutes } from './routes/zkteco/zkteco.routes';
import { attendanceRoutes } from './routes/attendance/attendance.routes';
import { reportsRoutes } from './routes/reports/reports.routes';
import { posRoutes } from './routes/pos/pos.routes';
import { anomalyRoutes } from './routes/anomalies/anomaly.routes';
import { forecastRoutes } from './routes/forecast/forecast.routes';
import qrRoutes from './routes/qr/qr.routes';
import webhooksRoutes from './routes/webhooks/webhooks.routes';
import { initSocketIO } from './lib/socket';
import { rbacMiddleware } from './middleware/rbac.middleware';
import { prisma } from '@swiftserve/db';
import { zktecoService } from './services/zkteco.service';
import { processPunch } from './services/attendance.service';
import { initSmsWorker } from './jobs/sms.worker';
import { processAbandonedShifts } from './jobs/abandonedShifts';
import { initAnomalyWorker } from './jobs/anomalyWorker';
import { initReportsWorker } from './jobs/reportsWorker';
import { anomalyQueue, reportsQueue } from './lib/queue';

const fastify = Fastify({
  logger: process.env.AXIOM_TOKEN ? {
    transport: {
      target: '@axiomhq/pino',
      options: {
        dataset: process.env.AXIOM_DATASET,
        token: process.env.AXIOM_TOKEN,
      }
    }
  } : true,
}).withTypeProvider<ZodTypeProvider>();

const customValidatorCompiler: FastifySchemaCompiler<any> = ({ schema }) => {
  return (data) => {
    try {
      const result = (schema as ZodTypeAny).safeParse(data);
      if (result.success) {
        return { value: result.data };
      }
      return { error: result.error };
    } catch (err) {
      return { error: err as Error };
    }
  };
};

fastify.setValidatorCompiler(customValidatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

async function build() {
  // Better Auth uses cookies. Browsers will block `credentials: "include"` unless
  // CORS responds with a specific origin + `access-control-allow-credentials: true`.
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8084')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow non-browser requests (no Origin header)
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  });

  await fastify.register(authRoutes);
  await fastify.register(mobileRoutes);
  await fastify.register(mobileFeatureRoutes);
  await fastify.register(tenantRoutes);
  await fastify.register(userRoutes);
  await fastify.register(menuRoutes);
  await fastify.register(orderRoutes);
  await fastify.register(voidRoutes);
  await fastify.register(pinRoutes);
  await fastify.register(shiftRoutes);
  await fastify.register(kdsRoutes);
  await fastify.register(inventoryRoutes);
  await fastify.register(dealsRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(aiRoutes);
  await fastify.register(searchSyncRoutes);
  await fastify.register(crmRoutes);
  await fastify.register(customerRoutes, { prefix: '/api/customers' });
  await fastify.register(loyaltyRoutes, { prefix: '/api/loyalty' });
  await fastify.register(rewardsRoutes);
  await fastify.register(deliveryRoutes);
  await fastify.register(riderRoutes);
  await fastify.register(paymentsRoutes);
  await fastify.register(receiptsRoutes);
  await fastify.register(aggregatorsRoutes);
  await fastify.register(integrationsRoutes);
  await fastify.register(floorPlanRoutes);

  fastify.addHook('preHandler', rbacMiddleware);

  await fastify.register(tenantDashboardRoutes);
  await fastify.register(staffRoutes);
  await fastify.register(fleetRoutes);
  await fastify.register(branchesRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(billingRoutes);
  await fastify.register(zktecoRoutes, { prefix: '/api/zkteco' });
  await fastify.register(attendanceRoutes, { prefix: '/api/attendance' });
  await fastify.register(reportsRoutes, { prefix: '/api/reports' });
  await fastify.register(posRoutes);
  await fastify.register(anomalyRoutes, { prefix: '/api/anomalies' });
  await fastify.register(forecastRoutes, { prefix: '/api/forecast' });
  await fastify.register(qrRoutes, { prefix: '/api/qr' });
  await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
  await fastify.register(webhooksRoutes, { prefix: '/api/webhooks' });

  fastify.get('/health', async (request, reply) => {
    try {
      const { redis } = await import('./lib/redis.js');
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      
      return { 
        status: 'ok', 
        database: 'connected', 
        redis: 'connected', 
        timestamp: new Date().toISOString() 
      };
    } catch (e: any) {
      fastify.log.error('Health check failed: ' + e.message);
      return reply.status(503).send({
        status: 'error',
        message: 'Service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/me — debug endpoint
   * Returns the full user record the API resolves from the current session cookie.
   * Useful to verify tenantId / branchId / role are populated after login.
   * Safe to remove in production.
   */
  fastify.get('/api/me', async (request, reply) => {
    const { requireAuth } = await import('./middleware/auth.js');
    await requireAuth(request as any, reply);
    if (reply.sent) return;
    return { user: (request as any).user };
  });

  const { hasZodFastifySchemaValidationErrors } = await import('fastify-type-provider-zod');
  fastify.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Validation failed',
        issues: error.validation
      });
    }
    // Fallback
    request.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: error.message || 'Something went wrong'
    });
  });

  fastify.addHook('onReady', async () => {
    try {
      const devices = await prisma.zktecoDevice.findMany({
        where: { status: { not: 'DISABLED' } }
      });

      for (const device of devices) {
        const connected = await zktecoService.connect({
          ip: device.ipAddress,
          port: device.port,
          timeout: 5000,
          tenantId: device.tenantId,
          branchId: device.branchId,
          deviceId: device.id
        });

        if (connected) {
          zktecoService.startPolling(device.id, processPunch);
          fastify.log.info(`ZKTeco device connected: ${device.name} at ${device.ipAddress}`);
        } else {
          fastify.log.warn(`ZKTeco device offline: ${device.name} at ${device.ipAddress}`);
        }
      }
    } catch (e) {
      fastify.log.error('Failed to initialize ZKTeco devices: ' + e);
    }
  });

  return fastify;
}

async function start() {
  try {
    const app = await build();
    await app.listen({ port: Number(process.env.PORT) || 8080, host: '0.0.0.0' });
    app.log.info(`Server started on port ${process.env.PORT || 8080}`);

    // Attach Socket.IO to the underlying HTTP server AFTER Fastify is listening
    // so the HTTP server instance is fully initialised.
    initSocketIO(app.server);
    app.log.info('Socket.IO v4 initialized with Redis adapter');

    // Background jobs
    initSmsWorker();
    initAnomalyWorker();
    initReportsWorker();

    // Schedule repeatable jobs
    anomalyQueue.add('detectAnomalies', {}, { repeat: { pattern: '*/15 * * * *' } });
    reportsQueue.add('runReportsJob', {}, { repeat: { pattern: '* * * * *' } });

    // Run abandoned shifts check every hour
    setInterval(() => {
      processAbandonedShifts().catch(e => app.log.error('Abandoned shifts job failed', e));
    }, 60 * 60 * 1000);
    // Also run once on startup
    processAbandonedShifts().catch(e => app.log.error('Abandoned shifts job failed on startup', e));

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
