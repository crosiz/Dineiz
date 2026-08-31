import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { z } from 'zod';
import { prisma } from '@dineiz/db';
import { parseTableOverride } from '@dineiz/schemas';
import { emitOrderUpdated, emitOrderCancelled, emitNewOrder } from '../../lib/socket';
import {
  applyOrderStatusSideEffects, createOrder, updateOrder, appendOrderItems,
} from '../order/order.service';
import { recomputeTableStatus, setTableOverride } from '../../lib/tableStatus';
import { withIdempotency } from '../../lib/idempotency';
import { upstash } from '../../lib/redis';
import crypto from 'crypto';

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

  // ── Orphan orders (spec Part 2 — Shift Ownership) ───────────────────────
  // An order still PENDING/IN_KITCHEN/READY whose shift has CLOSED or been
  // ABANDONED. It must never silently reappear in a new shift — the POS
  // blocks the home screen with a resolution modal on shift open and calls
  // these two endpoints.

  fastify.get('/api/pos/orphans', {
    schema: {
      querystring: z.object({
        branchId: z.string(),
        withinHours: z.coerce.number().min(1).max(168).optional(),
      }),
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { branchId, withinHours } = request.query as { branchId: string; withinHours?: number };

    // The orphan modal is a blocking, one-order-at-a-time (manager PIN each)
    // gate on the home screen. Its purpose is "a shift closed and left food
    // that may still be cooking" — a live operational hand-off, not a
    // historical-data cleanup. Without a window it also surfaces every order
    // ever abandoned in a non-terminal state (dev seed data alone leaves
    // dozens), producing an un-clearable modal. Bound it to the recent past;
    // anything older is stale and belongs to an admin cleanup path, not the
    // next cashier. Also hard-cap the list so the modal can never be
    // unbounded even inside the window.
    const ORPHAN_WINDOW_HOURS = withinHours ?? 24;
    const ORPHAN_LIMIT = 40;
    const cutoff = new Date(Date.now() - ORPHAN_WINDOW_HOURS * 3600_000);

    const [orphans, totalInWindow] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId,
          branchId,
          status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
          shiftId: { not: null },
          shift: { status: { not: 'OPEN' } },
          createdAt: { gte: cutoff },
        },
        select: {
          id: true, orderNumber: true, status: true, type: true,
          netAmount: true, totalAmount: true, createdAt: true, shiftId: true,
          table: { select: { label: true } },
          shift: { select: { id: true, status: true, closedAt: true, user: { select: { name: true } } } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: ORPHAN_LIMIT,
      }),
      prisma.order.count({
        where: {
          tenantId,
          branchId,
          status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
          shiftId: { not: null },
          shift: { status: { not: 'OPEN' } },
          createdAt: { gte: cutoff },
        },
      }),
    ]);

    reply.header('x-orphan-total', String(totalInWindow));

    return reply.send(orphans.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      type: o.type,
      total: o.netAmount ?? o.totalAmount ?? 0,
      itemCount: o._count.items,
      tableLabel: o.table?.label ?? null,
      createdAt: o.createdAt.toISOString(),
      originalShiftId: o.shiftId,
      originalShiftStatus: o.shift?.status ?? null,
      originalCashier: o.shift?.user?.name ?? null,
    })));
  });

  fastify.post('/api/pos/orphans/:orderId/resolve', {
    schema: {
      params: z.object({ orderId: z.string() }),
      body: z.object({
        action: z.enum(['ADOPT', 'CANCEL']),
        intoShiftId: z.string().optional(),
        overridePin: z.string(),
        overrideReason: z.string().min(1),
      }),
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { orderId } = request.params as { orderId: string };
    const { action, intoShiftId, overridePin, overrideReason } = request.body as {
      action: 'ADOPT' | 'CANCEL'; intoShiftId?: string; overridePin: string; overrideReason: string;
    };

    // Manager PIN gate — same lookup shift.service.closeShift uses.
    const manager = await prisma.user.findFirst({
      where: { tenantId, posPin: overridePin, role: { in: ['BRANCH_MANAGER', 'TENANT_ADMIN'] } },
      select: { id: true, name: true },
    });
    if (!manager) return reply.status(403).send({ error: 'Invalid manager PIN or insufficient permissions' });

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId, status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] } },
      select: { id: true, branchId: true, shiftId: true, tableId: true, orderNumber: true },
    });
    if (!order) return reply.status(404).send({ error: 'Order not found or already resolved' });

    if (action === 'ADOPT') {
      if (!intoShiftId) return reply.status(400).send({ error: 'intoShiftId is required to adopt' });
      const target = await prisma.shift.findFirst({
        where: { id: intoShiftId, tenantId, branchId: order.branchId, status: 'OPEN' },
        select: { id: true },
      });
      if (!target) return reply.status(400).send({ error: 'Target shift is not open at this branch' });

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          shiftId: intoShiftId,
          adoptedFromShiftId: order.shiftId,
          adoptedByUserId: manager.id,
        },
      });

      // Audit trail on BOTH shifts. Revenue attribution in reports still
      // keys off adoptedFromShiftId, not the adopting shift.
      await prisma.shiftActivity.createMany({
        data: [
          {
            shiftId: order.shiftId!,
            activityType: 'FORCE_CLOSED' as any, // no ADOPTED enum yet — closest existing marker
            performedById: manager.id,
            notes: `Order ${order.orderNumber} adopted OUT to shift ${intoShiftId} by ${manager.name} — ${overrideReason}`,
            metadata: { orderId, adoptedIntoShiftId: intoShiftId, kind: 'ORDER_ADOPTED_OUT' },
          },
          {
            shiftId: intoShiftId,
            activityType: 'OPENED' as any,
            performedById: manager.id,
            notes: `Order ${order.orderNumber} adopted IN from shift ${order.shiftId} by ${manager.name} — ${overrideReason}`,
            metadata: { orderId, adoptedFromShiftId: order.shiftId, kind: 'ORDER_ADOPTED_IN' },
          },
        ],
      }).catch((e) => console.warn('[orphans] shift activity write failed', e));

      emitOrderUpdated(tenantId, order.branchId, updated);
      if (order.tableId) recomputeTableStatus(tenantId, order.tableId).catch(() => {});
      return reply.send({ ok: true, action, order: updated });
    }

    // CANCEL
    const priorStatus = (await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }))?.status ?? null;
    const cancelled = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', notes: `Orphan cancelled by ${manager.name} — ${overrideReason}` },
    });
    await applyOrderStatusSideEffects(tenantId, cancelled, priorStatus, {});
    await prisma.shiftActivity.create({
      data: {
        shiftId: order.shiftId!,
        activityType: 'ORDER_VOIDED' as any,
        performedById: manager.id,
        notes: `Orphan order ${order.orderNumber} cancelled by ${manager.name} — ${overrideReason}`,
        metadata: { orderId, kind: 'ORPHAN_CANCELLED' },
      },
    }).catch(() => {});
    emitOrderCancelled(tenantId, order.branchId, orderId);
    return reply.send({ ok: true, action, order: cancelled });
  });

  // ── Manager overlay (spec Part 10) ─────────────────────────────────────
  // A temporary elevated session a manager runs ON a cashier's terminal.
  // The cashier's session is never touched; this is purely the
  // authorisation + audit record.

  fastify.post('/api/pos/manager-override/start', {
    schema: {
      body: z.object({
        pin: z.string(),
        reason: z.string().optional(),
        oneShot: z.boolean().optional(),
        shiftId: z.string().optional(),
        cashierId: z.string().optional(),
        cashierName: z.string().optional(),
        terminalId: z.string().optional(),
        branchId: z.string(),
      }),
    },
    preHandler: requireRole(['CASHIER', 'WAITER', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const sessionUserId = request.user!.id!;
    const b = request.body as {
      pin: string; reason?: string; oneShot?: boolean;
      shiftId?: string; cashierId?: string; cashierName?: string; terminalId?: string; branchId: string;
    };

    // Part 12 — 5 wrong PINs locks override attempts on this terminal for 5 min.
    const lockKey = `mgr_override_lock:${sessionUserId}`;
    const attemptsKey = `mgr_override_attempts:${sessionUserId}`;
    try {
      if (await upstash.get(lockKey)) {
        const ttl = await upstash.ttl(lockKey).catch(() => 300);
        return reply.status(429).send({ error: 'Too many failed attempts. Try again shortly.', retryAfter: typeof ttl === 'number' && ttl > 0 ? ttl : 300 });
      }
    } catch { /* Redis down — proceed without lockout */ }

    const hashedPin = crypto.createHash('sha256').update(b.pin).digest('hex');
    const manager = await prisma.user.findFirst({
      where: { tenantId, posPin: hashedPin, status: 'ACTIVE', role: { in: ['BRANCH_MANAGER', 'TENANT_ADMIN'] } },
      select: { id: true, name: true, role: true },
    });

    if (!manager) {
      try {
        const n = await upstash.incr(attemptsKey);
        if (n === 1) await upstash.expire(attemptsKey, 300);
        if (n >= 5) { await upstash.set(lockKey, '1', { ex: 300 }); await upstash.del(attemptsKey); }
      } catch { /* ignore */ }
      return reply.status(401).send({ error: 'Invalid manager PIN' });
    }
    try { await upstash.del(attemptsKey); } catch { /* ignore */ }

    // A branch that requires a reason but none was given.
    const branding = await prisma.tenantBranding.findUnique({ where: { tenantId }, select: { managerOverlayEnabled: true, managerOverlayRequireReason: true } });
    if (branding && branding.managerOverlayEnabled === false) {
      return reply.status(403).send({ error: 'Manager override is disabled for this business' });
    }
    if (branding?.managerOverlayRequireReason && !b.reason?.trim()) {
      return reply.status(400).send({ error: 'A reason is required to start a manager override' });
    }

    const row = await prisma.managerOverride.create({
      data: {
        tenantId, branchId: b.branchId, terminalId: b.terminalId ?? null,
        shiftId: b.shiftId ?? null, cashierId: b.cashierId ?? null, cashierName: b.cashierName ?? null,
        managerId: manager.id, managerName: manager.name, reason: b.reason?.trim() || null,
        oneShot: !!b.oneShot,
      },
      select: { id: true },
    });

    return reply.send({ id: row.id, manager: { id: manager.id, name: manager.name, role: manager.role } });
  });

  fastify.post('/api/pos/manager-override/:id/action', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ action: z.string(), targetId: z.string().optional(), meta: z.any().optional() }),
    },
    preHandler: requireRole(['CASHIER', 'WAITER', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params as { id: string };
    const { action, targetId, meta } = request.body as { action: string; targetId?: string; meta?: unknown };

    const row = await prisma.managerOverride.findFirst({ where: { id, tenantId }, select: { actions: true, endedAt: true } });
    if (!row) return reply.status(404).send({ error: 'Override session not found' });

    const actions = Array.isArray(row.actions) ? (row.actions as any[]) : [];
    actions.push({ at: new Date().toISOString(), action, targetId: targetId ?? null, meta: meta ?? null });
    await prisma.managerOverride.update({ where: { id }, data: { actions } });
    return reply.send({ ok: true, actionCount: actions.length });
  });

  fastify.post('/api/pos/manager-override/:id/end', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({ exitReason: z.string().optional() }),
    },
    preHandler: requireRole(['CASHIER', 'WAITER', 'BRANCH_MANAGER', 'TENANT_ADMIN']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const { id } = request.params as { id: string };
    const { exitReason } = request.body as { exitReason?: string };

    const row = await prisma.managerOverride.findFirst({ where: { id, tenantId }, select: { startedAt: true, endedAt: true } });
    if (!row) return reply.status(404).send({ error: 'Override session not found' });
    if (row.endedAt) return reply.send({ ok: true, alreadyEnded: true });

    const endedAt = new Date();
    await prisma.managerOverride.update({
      where: { id },
      data: { endedAt, durationSec: Math.round((endedAt.getTime() - row.startedAt.getTime()) / 1000), exitReason: exitReason ?? 'MANUAL' },
    });
    return reply.send({ ok: true });
  });

  // ── Batch event ingestion (spec Part 5 — the sync engine) ───────────────
  //
  // The POS outbox (apps/pos/lib/core/outbox.ts) derives a small set of
  // typed operations from its local event log and ships up to 50 of them in
  // ONE request instead of a fan-out of 40. Each op is executed in order
  // against the same domain services the individual REST endpoints use
  // (createOrder / updateOrder / appendOrderItems / table status), so there
  // is exactly one code path for the business logic. The response is a
  // per-op result array — partial success is normal, and the client applies
  // each result to its own event log independently.

  const BatchOpSchema = z.object({
    opId: z.string(),
    kind: z.enum([
      'CREATE_ORDER', 'ADD_ITEMS', 'UPDATE_STATUS', 'COLLECT_PAYMENT',
      'UPDATE_TABLE_STATUS', 'REQUEST_BILL', 'CLEAN_TABLE',
    ]),
    aggregateId: z.string(),
    targetId: z.string().nullable().optional(),
    idempotencyKey: z.string().optional(),
    body: z.any(),
  });

  fastify.post('/api/pos/events/batch', {
    schema: {
      body: z.object({
        terminalId: z.string().optional(),
        ops: z.array(BatchOpSchema).min(1).max(50),
      }),
    },
    preHandler: requireRole(['TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER']),
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const userId = request.user!.id!;
    const { ops } = request.body as {
      ops: Array<{ opId: string; kind: string; aggregateId: string; targetId?: string | null; idempotencyKey?: string; body: any }>;
    };

    type OpResult = { opId: string; ok: boolean; status: number; body?: any; error?: string; permanent?: boolean };
    const results: OpResult[] = [];

    // aggregateId -> server id for CREATE_ORDER ops earlier in this same
    // batch, so a dependent op that arrives before reconcileServerId ran on
    // the client can still resolve its target.
    const createdIdByAggregate = new Map<string, string>();
    // Once an op for an aggregate fails, its later ops in this batch are
    // skipped rather than executed against a half-applied state.
    const failedAggregates = new Set<string>();

    const classify = (e: any): { status: number; permanent: boolean } => {
      const status = typeof e?.statusCode === 'number' ? e.statusCode
        : e?.code === 'P2002' ? 409
        : e?.code === 'P2025' ? 404
        : 500;
      const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
      return { status, permanent };
    };

    for (const op of ops) {
      if (failedAggregates.has(op.aggregateId)) {
        results.push({ opId: op.opId, ok: false, status: 424, permanent: false, error: 'skipped — earlier op for this aggregate failed' });
        continue;
      }

      const target = op.targetId || createdIdByAggregate.get(op.aggregateId) || null;

      try {
        switch (op.kind) {
          case 'CREATE_ORDER': {
            const { statusCode, body } = await withIdempotency(
              tenantId, 'POST /api/orders', op.idempotencyKey,
              async () => {
                const order = await createOrder(tenantId, userId, op.body);
                emitNewOrder(tenantId, op.body.branchId, order);
                if (op.body.tableId) recomputeTableStatus(tenantId, op.body.tableId).catch(() => {});
                return { statusCode: 201, body: order };
              },
            );
            if (statusCode >= 200 && statusCode < 300 && body?.id) {
              createdIdByAggregate.set(op.aggregateId, body.id);
            }
            results.push({ opId: op.opId, ok: statusCode < 300, status: statusCode, body });
            if (statusCode >= 300) failedAggregates.add(op.aggregateId);
            break;
          }

          case 'ADD_ITEMS': {
            if (!target) { results.push({ opId: op.opId, ok: false, status: 409, permanent: false, error: 'no target order yet' }); break; }
            const { statusCode, body } = await withIdempotency(
              tenantId, 'POST /api/orders/:id/items', op.idempotencyKey,
              async () => ({ statusCode: 200, body: await appendOrderItems(tenantId, target, op.body.items) }),
            );
            results.push({ opId: op.opId, ok: statusCode < 300, status: statusCode, body });
            break;
          }

          case 'UPDATE_STATUS':
          case 'COLLECT_PAYMENT':
          case 'REQUEST_BILL': {
            if (!target) { results.push({ opId: op.opId, ok: false, status: 409, permanent: false, error: 'no target order yet' }); break; }
            const prior = await prisma.order.findUnique({ where: { id: target, tenantId }, select: { status: true } });
            const order = await updateOrder(tenantId, target, op.body);
            await applyOrderStatusSideEffects(tenantId, order, prior?.status ?? null, {
              payments: op.body?.payments,
              redeemedPointsAmount: op.body?.redeemedPointsAmount,
            });
            results.push({ opId: op.opId, ok: true, status: 200, body: { id: order.id, status: order.status } });
            break;
          }

          case 'UPDATE_TABLE_STATUS': {
            const parsed = parseTableOverride(op.body?.status);
            const resolved = await setTableOverride(tenantId, op.aggregateId, parsed === 'CLEAR' ? null : parsed);
            results.push({ opId: op.opId, ok: true, status: 200, body: { id: op.aggregateId, status: resolved } });
            break;
          }

          case 'CLEAN_TABLE': {
            await prisma.table.update({ where: { id: op.aggregateId }, data: { lastCompletedAt: null } }).catch(() => {});
            const resolved = await recomputeTableStatus(tenantId, op.aggregateId);
            results.push({ opId: op.opId, ok: true, status: 200, body: { id: op.aggregateId, status: resolved } });
            break;
          }

          default:
            results.push({ opId: op.opId, ok: false, status: 400, permanent: true, error: `unknown op kind ${op.kind}` });
        }
      } catch (e: any) {
        const { status, permanent } = classify(e);
        results.push({ opId: op.opId, ok: false, status, permanent, error: e?.message ?? 'op failed' });
        failedAggregates.add(op.aggregateId);
      }
    }

    return reply.send({ results });
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
