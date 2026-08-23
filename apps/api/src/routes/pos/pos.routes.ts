import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { z } from 'zod';
import { prisma } from '@dineiz/db';

export const posRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/pos/stats', {
    schema: {
      querystring: z.object({ shiftId: z.string() })
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  }, async (request, reply) => {
    const { shiftId } = request.query;
    const tenantId = (request.user!.tenantId as string);

    const where = { shiftId, status: 'COMPLETED' as const, tenantId };
    const [count, aggregate] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { netAmount: true } })
    ]);
    
    const total = aggregate._sum.netAmount ?? 0;
    return reply.send({
      ordersServed: count,
      totalValue: Math.round(Number(total)),
      avgPerOrder: count > 0 ? Math.round(Number(total) / count) : 0
    });
  });

  // ── Dead letters — Phase 6 of the local-first rewrite ────────────────────
  // A POS terminal's outbox (lib/core/outbox.ts) marks an event POISONED
  // once it's exhausted its retries and been rejected by the server for
  // real (not a connectivity blip). That state only exists in the
  // terminal's own IndexedDB — these three endpoints let it report the
  // fact server-side, so a manager can see "this order never made it"
  // without physically walking over to that terminal.

  fastify.post('/api/pos/dead-letters', {
    schema: {
      body: z.object({
        branchId: z.string(),
        terminalId: z.string(),
        eventId: z.string(),
        eventType: z.string(),
        aggregateId: z.string(),
        aggregateType: z.string(),
        payload: z.any(),
        attempts: z.number(),
        lastError: z.string().nullable().optional(),
      }),
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const b = request.body;
    // Same event reported twice (e.g. the terminal retried the report
    // itself) — upsert on the unique (tenantId, eventId) rather than error.
    const row = await prisma.posDeadLetter.upsert({
      where: { tenantId_eventId: { tenantId, eventId: b.eventId } },
      create: {
        tenantId, branchId: b.branchId, terminalId: b.terminalId,
        eventId: b.eventId, eventType: b.eventType, aggregateId: b.aggregateId,
        aggregateType: b.aggregateType, payload: b.payload, attempts: b.attempts,
        lastError: b.lastError ?? null,
      },
      update: { attempts: b.attempts, lastError: b.lastError ?? null },
    });
    return reply.status(201).send(row);
  });

  fastify.get('/api/pos/dead-letters', {
    schema: {
      querystring: z.object({ branchId: z.string().optional(), includeResolved: z.string().optional() }),
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { branchId, includeResolved } = request.query;
    const rows = await prisma.posDeadLetter.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(includeResolved === 'true' ? {} : { resolvedAt: null }),
      },
      orderBy: { poisonedAt: 'desc' },
      take: 200,
    });
    return reply.send(rows);
  });

  fastify.put('/api/pos/dead-letters/:id/resolve', {
    schema: { params: z.object({ id: z.string() }) },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params;
    const userId = request.user!.id!;
    const row = await prisma.posDeadLetter.updateMany({
      where: { id, tenantId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedBy: userId },
    });
    if (row.count === 0) return reply.status(404).send({ error: 'Not found or already resolved' });
    return reply.send({ success: true });
  });
};
