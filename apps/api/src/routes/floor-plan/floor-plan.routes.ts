import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { prisma } from '@dineiz/db';
import { FloorPlanUpdateSchema, TableCreateSchema, TableUpdateSchema, parseTableOverride, deriveTableStatus, toDbTableStatus } from '@dineiz/schemas';
import { requireRole, requireTenant } from '../../middleware/auth';
import { setTableOverride, recomputeTableStatus } from '../../lib/tableStatus';
import { z } from 'zod';

export const floorPlanRoutes: FastifyPluginAsyncZod = async (fastify) => {

  // GET /api/floor-plan/:branchId
  fastify.get('/api/floor-plan/:branchId', {
    schema: { params: z.object({ branchId: z.string() }) },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const tenantId = request.user!.tenantId!;

    // These three lookups are independent of each other — run them concurrently
    // instead of as a sequential waterfall.
    const [existingFloorPlan, tables, activeOrders, branding] = await Promise.all([
      prisma.floorPlan.findUnique({ where: { branchId } }),
      prisma.table.findMany({ where: { branchId, tenantId, isActive: true } }),
      prisma.order.findMany({
        where: {
          branchId,
          tenantId,
          status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
          type: 'DINE_IN',
          tableId: { not: null }
        },
        select: {
          id: true,
          status: true,
          tableId: true,
          createdAt: true,
          billRequestedAt: true,
          assignedWaiterId: true,
          assignedWaiterName: true,
          assignedWaiter: { select: { avatarColor: true } }
        }
      }),
      prisma.tenantBranding.findUnique({ where: { tenantId }, select: { tableCleaningMinutes: true } }),
    ]);

    let floorPlan = existingFloorPlan;
    if (!floorPlan) {
      floorPlan = await prisma.floorPlan.create({
        data: {
          branchId,
          floors: [{ floorNumber: 1, floorName: 'Ground Floor', width: 2000, height: 2000, backgroundColor: '#F5F0E8', items: [], walls: [], decor: [], zones: [] }]
        }
      });
    }

    // Part 3 — one derivation, the shared @dineiz/schemas one. Table.status
    // is kept current in the DB by recomputeTableStatus on every order event,
    // so this mostly just reflects that back; deriving again here is cheap
    // insurance against drift and keeps this endpoint honest.
    const cleaningMinutes = branding?.tableCleaningMinutes ?? 5;
    const tablesWithStatus = tables.map(t => {
      const ordersOnTable = activeOrders.filter(o => o.tableId === t.id);
      const order = ordersOnTable[0];

      const derivedStatus = deriveTableStatus({
        isActive: t.isActive,
        statusOverride: (t.statusOverride as any) ?? null,
        activeOrders: ordersOnTable.map(o => ({ status: o.status, billRequestedAt: o.billRequestedAt })),
        lastCompletedAt: t.lastCompletedAt,
        cleaningMinutes,
      });

      return {
        ...t,
        status: toDbTableStatus(derivedStatus),
        occupiedSince: order ? order.createdAt : null,
        activeOrderId: order?.id || null,
        assignedWaiterId: order?.assignedWaiterId || null,
        assignedWaiterName: order?.assignedWaiterName || null,
        assignedWaiterColor: order?.assignedWaiter?.avatarColor || null,
      };
    });

    return { id: floorPlan.id, branchId: floorPlan.branchId, floors: floorPlan.floors, tables: tablesWithStatus };
  });

  // POST /api/floor-plan/:branchId
  fastify.post('/api/floor-plan/:branchId', {
    schema: {
      params: z.object({ branchId: z.string() }),
      body: z.object({ floors: z.any() })
    },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const { floors } = (request.body as any);

    const floorPlan = await prisma.floorPlan.upsert({
      where: { branchId },
      update: { floors },
      create: { branchId, floors }
    });

    return floorPlan;
  });

  // GET /api/floor-plan/:branchId/tables
  fastify.get('/api/floor-plan/:branchId/tables', {
    schema: { params: z.object({ branchId: z.string() }) },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const tables = await prisma.table.findMany({
      where: { branchId, tenantId, isActive: true }
    });
    return tables;
  });

  // GET /api/tables/assigned
  fastify.get('/api/tables/assigned', {
    schema: {
      querystring: z.object({
        userId: z.string(),
        branchId: z.string()
      })
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { userId, branchId } = request.query as any;
    const tenantId = request.user!.tenantId!;

    const activeOrders = await prisma.order.findMany({
      where: {
        branchId,
        tenantId,
        assignedWaiterId: userId,
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
        type: 'DINE_IN',
        tableId: { not: null }
      },
      select: { tableId: true }
    });

    const assignedTableIds = Array.from(new Set(activeOrders.map(o => o.tableId)));

    return { assignedTableIds };
  });

  // POST /api/tables
  fastify.post('/api/tables', {
    schema: {
      body: z.any()
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const tenantId = request.user!.tenantId!;
    const data = request.body as any;
    const branchId = data.branchId || request.user?.branchId;

    if (!branchId) {
      return reply.status(400).send({ error: 'branchId is required' });
    }

    const table = await prisma.table.create({
      data: {
        ...data,
        branchId,
        tenantId,
      }
    });
    return table;
  });

  // POST /api/floor-plan/:branchId/tables
  fastify.post('/api/floor-plan/:branchId/tables', {
    schema: {
      params: z.object({ branchId: z.string() }),
      body: z.any() // Using any for now to bypass strict schema if TableCreateSchema doesn't match new fields
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const data = request.body as any;

    const table = await prisma.table.create({
      data: {
        ...data,
        branchId,
        tenantId,
      }
    });
    return table;
  });

  // PATCH /api/floor-plan/tables/:tableId
  fastify.patch('/api/floor-plan/tables/:tableId', {
    schema: {
      params: z.object({ tableId: z.string() }),
      body: z.any()
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const table = await prisma.table.update({
      where: { id: tableId, tenantId },
      data: (request.body as any)
    });
    return table;
  });

  // PUT /api/tables/:tableId
  fastify.put('/api/tables/:tableId', {
    schema: {
      params: z.object({ tableId: z.string() }),
      body: z.any()
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const table = await prisma.table.update({
      where: { id: tableId, tenantId },
      data: (request.body as any)
    });
    return table;
  });

  // PATCH /api/tables/:tableId
  fastify.patch('/api/tables/:tableId', {
    schema: {
      params: z.object({ tableId: z.string() }),
      body: z.any()
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const table = await prisma.table.update({
      where: { id: tableId, tenantId },
      data: (request.body as any)
    });
    return table;
  });

  // DELETE /api/floor-plan/tables/:tableId
  fastify.delete('/api/floor-plan/tables/:tableId', {
    schema: { params: z.object({ tableId: z.string() }) },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    await prisma.table.update({
      where: { id: tableId, tenantId },
      data: { isActive: false }
    });
    return { success: true };
  });

  // DELETE /api/tables/:tableId
  fastify.delete('/api/tables/:tableId', {
    schema: { params: z.object({ tableId: z.string() }) },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    await prisma.table.update({
      where: { id: tableId, tenantId },
      data: { isActive: false }
    });
    return { success: true };
  });

  // PATCH /api/floor-plan/:branchId/tables/bulk
  fastify.patch('/api/floor-plan/:branchId/tables/bulk', {
    schema: {
      params: z.object({ branchId: z.string() }),
      body: z.object({
        tables: z.array(z.any())
      })
    },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const { tables } = request.body as any;

    const results = await prisma.$transaction(
      tables.map((t: any) => prisma.table.upsert({
        where: { id: t.id },
        update: {
          label: t.label,
          positionX: t.positionX,
          positionY: t.positionY,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          capacity: t.capacity,
          shape: t.shape,
          floorNumber: t.floorNumber,
          isActive: t.isActive,
        },
        create: {
          id: t.id,
          branchId,
          tenantId,
          label: t.label,
          positionX: t.positionX,
          positionY: t.positionY,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          capacity: t.capacity,
          shape: t.shape,
          floorNumber: t.floorNumber,
          isActive: t.isActive !== undefined ? t.isActive : true,
        }
      }))
    );

    return { updated: results.length };
  });

  // GET /api/floor-plan/:branchId/table-orders
  fastify.get('/api/floor-plan/:branchId/table-orders', {
    schema: { params: z.object({ branchId: z.string() }) },
    preHandler: requireTenant
  }, async (request, reply) => {
    const { branchId } = (request.params as any);
    const tenantId = request.user!.tenantId!;

    const activeOrders = await prisma.order.findMany({
      where: {
        branchId,
        tenantId,
        status: { in: ['PENDING', 'IN_KITCHEN', 'READY'] },
        type: 'DINE_IN',
        tableId: { not: null }
      },
      select: {
        id: true,
        status: true,
        tableId: true,
        createdAt: true,
      }
    });

    const statuses = activeOrders.map(o => ({
      tableId: o.tableId!,
      status: o.status === 'READY' ? 'reserved' : 'occupied', // Mapping to required statuses
      orderId: o.id,
      guestCount: 0, // Placeholder
      duration: Math.floor((Date.now() - o.createdAt.getTime()) / 60000)
    }));

    return statuses;
  });

  // POST /api/floor-plan/tables/:tableId/duplicate
  fastify.post('/api/floor-plan/tables/:tableId/duplicate', {
    schema: { params: z.object({ tableId: z.string() }) },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;

    const table = await prisma.table.findUnique({
      where: { id: tableId, tenantId }
    });

    if (!table) return reply.status(404).send({ error: 'Table not found' });

    // Generate new label, e.g. T-2 -> T-3
    const match = table.label.match(/^(.*?)(\d+)$/);
    let newLabel = table.label + ' (Copy)';
    if (match) {
      newLabel = `${match[1]}${parseInt(match[2]) + 1}`;
    }

    const newTable = await prisma.table.create({
      data: {
        branchId: table.branchId,
        tenantId: table.tenantId,
        label: newLabel,
        capacity: table.capacity,
        shape: table.shape,
        floorNumber: table.floorNumber,
        positionX: table.positionX + 40,
        positionY: table.positionY + 40,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        isActive: true,
        status: 'free'
      }
    });

    return newTable;
  });

  // PUT /api/tables/:tableId/status
  //
  // Part 3 — table status is DERIVED from orders, so this endpoint only
  // accepts the three things a manager sets explicitly: RESERVED, INACTIVE,
  // or clearing an override ("free" / "available" / "clean"). Everything
  // else (occupied, dirty, bill_requested) comes out of the derivation and
  // can't be set by hand. setTableOverride() records the override then
  // recomputes so the visible status is right immediately, and emits the
  // socket event itself.
  fastify.put('/api/tables/:tableId/status', {
    schema: {
      params: z.object({ tableId: z.string() }),
      body: z.object({ status: z.string() })
    },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER'])
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const { status } = (request.body as any);
    const tenantId = request.user!.tenantId!;

    const table = await prisma.table.findFirst({ where: { id: tableId, tenantId }, select: { id: true } });
    if (!table) return reply.status(404).send({ error: 'Table not found' });

    const parsed = parseTableOverride(status);
    const resolved = await setTableOverride(tenantId, tableId, parsed === 'CLEAR' ? null : parsed);

    return reply.send({ id: tableId, status: resolved });
  });

  // POST /api/tables/:tableId/clean — a manager marked a DIRTY table clean
  // before the cleaning timer elapsed. Clears the timer anchor and re-derives
  // (→ FREE, assuming no active order).
  fastify.post('/api/tables/:tableId/clean', {
    schema: { params: z.object({ tableId: z.string() }) },
    preHandler: requireRole(['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAITER'])
  }, async (request, reply) => {
    const { tableId } = (request.params as any);
    const tenantId = request.user!.tenantId!;
    const table = await prisma.table.findFirst({ where: { id: tableId, tenantId }, select: { id: true } });
    if (!table) return reply.status(404).send({ error: 'Table not found' });

    await prisma.table.update({ where: { id: tableId }, data: { lastCompletedAt: null } });
    const resolved = await recomputeTableStatus(tenantId, tableId);
    return reply.send({ id: tableId, status: resolved });
  });

};


