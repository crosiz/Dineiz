import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@dineiz/db';
import { requireTenant } from '../../middleware/auth';
import { AnomalyType, AnomalySeverity, AnomalyStatus } from '@prisma/client';

export const anomalyRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /anomalies - List anomalies for tenant
  app.get(
    '/',
    {
      preHandler: requireTenant,
      schema: {
        querystring: z.object({
          branchId: z.string().optional(),
          status: z.nativeEnum(AnomalyStatus).optional(),
          severity: z.nativeEnum(AnomalySeverity).optional()
        })
      }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { branchId, status, severity } = request.query;

      const anomalies = await prisma.anomalyEvent.findMany({
        where: {
          tenantId,
          ...(branchId && { branchId }),
          ...(status && { status }),
          ...(severity && { severity })
        },
        orderBy: { detectedAt: 'desc' },
        include: {
          branch: { select: { name: true } },
          affectedUser: { select: { name: true, email: true } }
        }
      });

      return anomalies;
    }
  );

  // POST /anomalies/:id/status - Update anomaly status
  app.post(
    '/:id/status',
    {
      preHandler: requireTenant,
      schema: {
        params: z.object({
          id: z.string()
        }),
        body: z.object({
          status: z.nativeEnum(AnomalyStatus),
          resolutionNote: z.string().optional()
        })
      }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const { id } = request.params;
      const { status, resolutionNote } = request.body;

      const existing = await prisma.anomalyEvent.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ message: 'Anomaly not found' });

      const updated = await prisma.anomalyEvent.update({
        where: { id },
        data: { status, resolutionNote }
      });

      return updated;
    }
  );

  // GET /anomalies/settings - Get settings
  app.get(
    '/settings',
    {
      preHandler: requireTenant
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;

      let settings = await prisma.anomalySettings.findUnique({ where: { tenantId } });
      if (!settings) {
        // Create default settings if not exists
        settings = await prisma.anomalySettings.create({
          data: {
            tenantId,
            thresholds: {
              cashVarianceThreshold: 500,
              excessiveVoidsCount: 5,
              largeDiscountPct: 25
            },
            toggles: {
              CASH_VARIANCE: true,
              EXCESSIVE_VOIDS: true,
              LARGE_DISCOUNT: true
            }
          }
        });
      }

      return settings;
    }
  );

  // PUT /anomalies/settings - Update settings
  app.put(
    '/settings',
    {
      preHandler: requireTenant,
      schema: {
        body: z.object({
          thresholds: z.any().optional(),
          toggles: z.any().optional(),
          notifyPush: z.boolean().optional(),
          notifyEmail: z.boolean().optional(),
          notifyWhatsapp: z.boolean().optional()
        })
      }
    },
    async (request, reply) => {
      const { tenantId } = request.user as any;
      const body = request.body;

      const settings = await prisma.anomalySettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          thresholds: body.thresholds || {},
          toggles: body.toggles || {},
          notifyPush: body.notifyPush ?? true,
          notifyEmail: body.notifyEmail ?? false,
          notifyWhatsapp: body.notifyWhatsapp ?? false
        },
        update: {
          ...(body.thresholds && { thresholds: body.thresholds }),
          ...(body.toggles && { toggles: body.toggles }),
          ...(body.notifyPush !== undefined && { notifyPush: body.notifyPush }),
          ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
          ...(body.notifyWhatsapp !== undefined && { notifyWhatsapp: body.notifyWhatsapp })
        }
      });

      return settings;
    }
  );
};
