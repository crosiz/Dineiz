import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireTenant } from '../../middleware/auth';
import { 
  generateRevenueForecast, 
  generateBusyPeriods, 
  generateItemsForecast, 
  generateInventoryForecast,
  preGenerateForecastsForTenant
} from './forecast.service';

export const forecastRoutes: FastifyPluginAsyncZod = async (app) => {
  const querySchema = z.object({
    branchId: z.string().optional()
  });

  app.get(
    '/revenue',
    {
      preHandler: requireTenant,
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { branchId } = request.query;
      const res = await generateRevenueForecast(tenantId, branchId);
      if (res?.error) return reply.status(400).send(res);
      return res;
    }
  );

  app.get(
    '/busy-periods',
    {
      preHandler: requireTenant,
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { branchId } = request.query;
      const res = await generateBusyPeriods(tenantId, branchId);
      if (res?.error) return reply.status(400).send(res);
      return res;
    }
  );

  app.get(
    '/items',
    {
      preHandler: requireTenant,
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { branchId } = request.query;
      const res = await generateItemsForecast(tenantId, branchId);
      if (res?.error) return reply.status(400).send(res);
      return res;
    }
  );

  app.get(
    '/inventory',
    {
      preHandler: requireTenant,
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { branchId } = request.query;
      const res = await generateInventoryForecast(tenantId, branchId);
      if (res?.error) return reply.status(400).send(res);
      return res;
    }
  );

  app.post(
    '/refresh',
    {
      preHandler: requireTenant
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      await preGenerateForecastsForTenant(tenantId);
      return { success: true, message: 'Forecasts regenerated.' };
    }
  );
};
