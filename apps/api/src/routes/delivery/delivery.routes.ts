import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { requireRole, requireTenant } from '../../middleware/auth';
import { z } from 'zod';
import { getEtaSeconds, pointInPolygon } from '../../lib/googleRoutes';

const ZoneCreateSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3), // [lng,lat]
});

const EtaSchema = z.object({
  branchId: z.string().min(1),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  origin: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const deliveryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Delivery zones
  fastify.get('/api/delivery/zones', {
    schema: { querystring: z.object({ branchId: z.string().min(1) }) },
    preHandler: requireTenant,
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const { branchId } = (request.query as any);
    return prisma.deliveryZone.findMany({ where: { tenantId, branchId }, orderBy: { name: 'asc' } });
  });

  fastify.post('/api/delivery/zones', {
    schema: { body: ZoneCreateSchema, response: { 201: z.any() } },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const zone = await prisma.deliveryZone.create({
      data: {
        tenantId,
        branchId: (request.body as any).branchId,
        name: (request.body as any).name,
        polygon: (request.body as any).polygon as any,
      },
    });
    return reply.status(201).send(zone);
  });

  // Compute ETA and detect delivery zone (best-effort)
  fastify.post('/api/delivery/eta', {
    schema: { body: EtaSchema, response: { 200: z.any() } },
    preHandler: requireTenant,
  }, async (request) => {
    const tenantId = request.user!.tenantId!;
    const { branchId, destination, origin } = (request.body as any);

    const zones = await prisma.deliveryZone.findMany({ where: { tenantId, branchId } });
    const zone = zones.find((z) => {
      const poly = z.polygon as unknown as Array<[number, number]>;
      return Array.isArray(poly) && poly.length >= 3 && pointInPolygon(destination, poly);
    });

    // Origin is optional; if not provided we return eta null.
    const etaSec = origin ? await getEtaSeconds({ origin, destination }) : null;

    return { etaSec, zoneId: zone?.id ?? null, zoneName: zone?.name ?? null };
  });
};



