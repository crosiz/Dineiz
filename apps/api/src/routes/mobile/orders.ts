import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@dineiz/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";
import { applyOrderStatusSideEffects } from "../order/order.service";

export const mobileOrdersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook('preHandler', mobileAuthMiddleware);

  // POST /api/mobile/orders
  fastify.post(
    "/api/mobile/orders",
    {
      schema: {
        body: z.object({
          branchId: z.string().optional(),
          totalAmount: z.number(),
          discountAmount: z.number().default(0),
          taxAmount: z.number().default(0),
          netAmount: z.number(),
          type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
          status: z.enum(['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED']).default('PENDING'),
          paymentMethod: z.string().optional(),
          tableName: z.string().optional(),
          tableId: z.string().optional(),
          offlineCreatedAt: z.string().optional(),
          notes: z.string().optional(),
          items: z.array(z.object({
            itemId: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            subtotal: z.number(),
            notes: z.string().optional()
          }))
        }),
        headers: z.object({
          'x-idempotency-key': z.string().optional()
        }).passthrough()
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId || !mobileUserReq.branchId) {
        return reply.status(400).send({ success: false, error: "No tenant or branch linked" });
      }

      const data = request.body as any;
      const idempotencyKey = request.headers['x-idempotency-key'] as string;

      if (idempotencyKey) {
        const existing = await prisma.order.findFirst({
          where: { tenantId: mobileUserReq.tenantId, notes: { contains: idempotencyKey } },
          include: { items: { include: { item: true } }, table: true }
        });
        if (existing) return { success: true, data: existing };
      }

      let createdAt = new Date();
      if (data.offlineCreatedAt) {
        const offlineDate = new Date(data.offlineCreatedAt);
        const diffHours = (Date.now() - offlineDate.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 0 && diffHours <= 24) {
          createdAt = offlineDate;
        }
      }

      // Resolve items by ID or fallback by name so offline synced orders never fail
      const itemIds = data.items.map((i: any) => i.itemId).filter(Boolean);
      const existingItems = await prisma.item.findMany({
        where: { tenantId: mobileUserReq.tenantId }
      });
      const itemMapById = new Map(existingItems.map((i: any) => [i.id, i]));
      const itemMapByName = new Map(existingItems.map((i: any) => [i.name.toLowerCase().trim(), i]));

      const validItems: any[] = [];
      for (const i of data.items) {
        let matched = itemMapById.get(i.itemId);
        if (!matched && i.name) {
          matched = itemMapByName.get(i.name.toLowerCase().trim());
        }
        if (!matched && existingItems.length > 0) {
          matched = existingItems[0]; // fallback to first item if name/id missing
        }
        if (matched) {
          validItems.push({
            itemId: matched.id,
            quantity: i.quantity || 1,
            unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : matched.basePrice,
            subtotal: typeof i.subtotal === 'number' ? i.subtotal : (matched.basePrice * (i.quantity || 1)),
            notes: i.notes || ''
          });
        }
      }

      if (validItems.length === 0) {
        return reply.status(400).send({ success: false, error: "No valid menu items in order payload" });
      }

      let orderNumber = `ORD-${1000 + (await prisma.order.count({ where: { tenantId: mobileUserReq.tenantId } })) + 1}`;

      // Resolve table if tableName provided
      let resolvedTableId = data.tableId;
      if (!resolvedTableId && data.tableName) {
        const tableObj = await prisma.table.findFirst({
          where: { tenantId: mobileUserReq.tenantId, label: data.tableName }
        });
        if (tableObj) resolvedTableId = tableObj.id;
      }

      let notesContent = data.tableName 
        ? `[Table: ${data.tableName}] ${data.notes || ''}`
        : (data.notes || '');

      if (data.paymentMethod) {
        notesContent = `${notesContent} [Payment:${data.paymentMethod}]`.trim();
      }

      // orderNumber has a @@unique([tenantId, orderNumber]) constraint —
      // this count()-based scheme is a classic TOCTOU race under concurrent
      // creates, and shares the same "ORD-" prefix as the POS's Redis-based
      // generator, so it can also collide with a POS-created order. Retry
      // with a freshly recomputed number on that specific violation.
      let order;
      for (let attempt = 0; ; attempt++) {
        try {
          order = await prisma.order.create({
            data: {
              tenantId: mobileUserReq.tenantId,
              branchId: mobileUserReq.branchId,
              orderNumber,
              totalAmount: data.totalAmount,
              discountAmount: data.discountAmount,
              taxAmount: data.taxAmount,
              netAmount: data.netAmount,
              type: data.type as any,
              status: data.status || 'PENDING',
              tableId: resolvedTableId,
              notes: idempotencyKey ? `${notesContent} [Idemp:${idempotencyKey}]` : notesContent,
              createdAt,
              items: {
                create: validItems.map((i: any) => ({
                  itemId: i.itemId,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  subtotal: i.subtotal,
                  notes: i.notes
                }))
              }
            },
            include: { items: { include: { item: true } }, table: true }
          });
          break;
        } catch (e: any) {
          const isOrderNumberCollision = e?.code === 'P2002' && e?.meta?.target?.includes?.('orderNumber');
          if (!isOrderNumberCollision || attempt >= 2) throw e;
          orderNumber = `ORD-${1000 + (await prisma.order.count({ where: { tenantId: mobileUserReq.tenantId } })) + 1}`;
        }
      }

      // Create Payment entry if paymentMethod is supplied and status is COMPLETED
      let paymentsForSideEffects: Array<{ method: string; amount: number; status: string }> | undefined;
      if (data.paymentMethod && data.status === 'COMPLETED') {
        try {
          const pm = (data.paymentMethod === 'CARD' ? 'CARD' : 'CASH') as any;
          await prisma.payment.create({
            data: {
              orderId: order.id,
              amount: data.totalAmount,
              method: pm,
              status: 'COMPLETED'
            }
          });
          paymentsForSideEffects = [{ method: pm, amount: data.totalAmount, status: 'COMPLETED' }];
        } catch (e) {
          console.warn("Failed to create payment record:", e);
        }
      }

      // A mobile order can be created already COMPLETED (e.g. a walk-in
      // logged after the fact) — nothing else will ever PUT this order
      // afterward, so this is the only chance for inventory/loyalty/deal
      // side effects to run for it.
      if (order.status === 'COMPLETED') {
        await applyOrderStatusSideEffects(mobileUserReq.tenantId, order, null, {
          payments: paymentsForSideEffects,
        });
      }

      return { success: true, data: order };
    }
  );

  // GET /api/mobile/orders
  fastify.get(
    "/api/mobile/orders",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const orders = await prisma.order.findMany({
        where: { tenantId: mobileUserReq.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { items: { include: { item: true } }, table: true, payments: true }
      });

      const formatted = orders.map(o => {
        let pm = o.payments?.[0]?.method as string | undefined;
        if (!pm && o.notes) {
          if (o.notes.includes('[Payment:')) {
            const match = o.notes.match(/\[Payment:(.*?)\]/);
            if (match && match[1]) pm = match[1];
          } else if (o.notes.toUpperCase().includes('CARD')) {
            pm = 'CARD';
          } else if (o.notes.toUpperCase().includes('JAZZCASH')) {
            pm = 'JAZZCASH';
          } else if (o.notes.toUpperCase().includes('EASYPAISA')) {
            pm = 'EASYPAISA';
          }
        }
        return {
          ...o,
          paymentMethod: pm || 'CASH'
        };
      });

      return { success: true, data: formatted };
    }
  );

  // GET /api/mobile/orders/stats
  fastify.get(
    "/api/mobile/orders/stats",
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);

      const orders = await prisma.order.findMany({
        where: { 
          tenantId: mobileUserReq.tenantId,
          createdAt: { gte: startOfDay },
          status: { not: 'CANCELLED' }
        },
        select: { netAmount: true, totalAmount: true, status: true }
      });

      const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || o.netAmount || 0), 0);
      const orderCount = orders.length;

      return { 
        success: true, 
        data: {
          totalRevenue,
          orderCount,
          todayRevenue: totalRevenue,
          todayOrders: orderCount,
          averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0
        }
      };
    }
  );

  // PUT /api/mobile/orders/:id/status
  fastify.put(
    "/api/mobile/orders/:id/status",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ 
          status: z.string(),
          paymentMethod: z.string().optional(),
          totalAmount: z.number().optional(),
          taxAmount: z.number().optional(),
          discountAmount: z.number().optional(),
          netAmount: z.number().optional()
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const { id } = request.params as any;
      const { status, paymentMethod, totalAmount, taxAmount, discountAmount, netAmount } = request.body as any;

      const order = await prisma.order.findFirst({
        where: { id, tenantId: mobileUserReq.tenantId }
      });

      if (!order) return reply.status(404).send({ success: false, error: "Order not found" });

      const updateData: any = { status: status as any };
      if (typeof totalAmount === 'number') updateData.totalAmount = totalAmount;
      if (typeof taxAmount === 'number') updateData.taxAmount = taxAmount;
      if (typeof discountAmount === 'number') updateData.discountAmount = discountAmount;
      if (typeof netAmount === 'number') updateData.netAmount = netAmount;
      if (paymentMethod) {
        updateData.notes = `${order.notes || ''} [Payment:${paymentMethod}]`.trim();
      }

      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: { items: { include: { item: true } }, table: true, payments: true }
      });

      let paymentsForSideEffects: Array<{ method: string; amount: number; status: string }> | undefined;
      if (paymentMethod && status === 'COMPLETED') {
        try {
          const pm = (paymentMethod === 'CARD' ? 'CARD' : 'CASH') as any;
          const amount = typeof totalAmount === 'number' ? totalAmount : order.totalAmount;
          await prisma.payment.create({
            data: {
              orderId: order.id,
              amount,
              method: pm,
              status: 'COMPLETED'
            }
          });
          paymentsForSideEffects = [{ method: pm, amount, status: 'COMPLETED' }];
        } catch (e) {
          console.warn("Payment entry error:", e);
        }
      }

      // This used to be a raw prisma.order.update() with no follow-up at
      // all — an order marked COMPLETED from the mobile app never got
      // inventory deducted, loyalty earned, deal counters bumped, or
      // Zapier/ERP notified, and one marked CANCELLED never had its
      // inventory reversed. Same shared helper the POS PUT path and KDS
      // now both go through.
      await applyOrderStatusSideEffects(mobileUserReq.tenantId, updated, order.status, {
        payments: paymentsForSideEffects,
      });

      return {
        success: true,
        data: {
          ...updated,
          paymentMethod: paymentMethod || updated.payments?.[0]?.method || 'CASH'
        }
      };
    }
  );

  // POST /api/mobile/orders/:id/items (Append items to an existing open/pending order)
  fastify.post(
    "/api/mobile/orders/:id/items",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          items: z.array(z.object({
            itemId: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            subtotal: z.number()
          }))
        })
      }
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      if (!mobileUserReq.tenantId) return reply.status(400).send({ success: false, error: "No tenant linked" });

      const { id } = request.params as any;
      const { items } = request.body as any;

      const order = await prisma.order.findFirst({
        where: { id, tenantId: mobileUserReq.tenantId },
        include: { items: true }
      });

      if (!order) return reply.status(404).send({ success: false, error: "Order not found" });

      // Add new items
      await prisma.orderItem.createMany({
        data: items.map((i: any) => ({
          orderId: id,
          itemId: i.itemId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal
        }))
      });

      // Recalculate totals
      const allItems = await prisma.orderItem.findMany({ where: { orderId: id } });
      const newTotal = allItems.reduce((sum, item) => sum + item.subtotal, 0);

      const updated = await prisma.order.update({
        where: { id },
        data: {
          totalAmount: newTotal,
          netAmount: newTotal
        },
        include: { items: { include: { item: true } }, table: true }
      });

      return { success: true, data: updated };
    }
  );
};
