/**
 * socket.ts — Socket.IO v4 server with Redis adapter
 *
 * Architecture:
 *   - One Socket.IO server attached to the same HTTP server as Fastify.
 *   - Redis pub/sub adapter allows horizontal scaling (multiple API instances
 *     share events across nodes via Redis channels).
 *   - Namespaces:
 *       /kds   → Kitchen Display System broadcasts
 *       /pos   → POS terminal events (order status updates, shift events)
 *
 * Room naming conventions:
 *   Branch-level rooms  : `branch:{branchId}`
 *   Tenant-level rooms  : `tenant:{tenantId}`
 *   Station-level rooms : `station:{stationId}`
 *
 * Events emitted by the server (server → client):
 *   kds:new_order         New order arrived for the kitchen
 *   kds:order_updated     Order status changed (IN_KITCHEN → READY etc.)
 *   kds:order_cancelled   Order was cancelled
 *   pos:order_ready       Order is ready for pickup / delivery
 *   pos:shift_event       Shift opened / closed at a branch
 *
 * Events received from clients (client → server):
 *   join_branch           Client subscribes to a branch room
 *   join_station          KDS subscribes to a specific station room
 *   kds:start_order       Transition order to IN_KITCHEN
 *   kds:bump_order        Transition order to READY
 *   kds:recall_order      Transition order back to IN_KITCHEN
 *   kds:cancel_order      Cancel an order
 */

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server as HttpServer } from 'http';

// ─── Singleton ────────────────────────────────────────────────────────────────

let io: SocketIOServer | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Attaches Socket.IO to the given HTTP server and configures the Redis adapter.
 * Should be called exactly once during server startup, after Fastify is ready.
 */
export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  // The Redis adapter is only needed to fan events out across multiple API
  // instances. A single local dev process doesn't need it — and each of its
  // pub/sub clients is another persistent connection against a
  // connection-limited Redis plan. Skip it locally via DISABLE_QUEUE_WORKERS
  // (same flag as lib/queue.ts) and fall back to Socket.IO's in-memory adapter.
  const useRedisAdapter = process.env.DISABLE_QUEUE_WORKERS !== 'true';
  let adapter: ReturnType<typeof createAdapter> | undefined;
  if (useRedisAdapter) {
    const pubClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const subClient = pubClient.duplicate();

    pubClient.on('error', (e) => console.error('[Socket.IO Redis pub]', e.message));
    subClient.on('error', (e) => console.error('[Socket.IO Redis sub]', e.message));

    adapter = createAdapter(pubClient, subClient);
  } else {
    console.log('DISABLE_QUEUE_WORKERS=true — Socket.IO using in-memory adapter (no Redis)');
  }

  io = new SocketIOServer(httpServer, {
    ...(adapter ? { adapter } : {}),
    cors: {
      origin: [
        process.env.DASHBOARD_URL ?? 'http://localhost:3000',
        process.env.POS_URL       ?? 'http://localhost:3001',
        process.env.KDS_URL       ?? 'http://localhost:3002',
      ],
      credentials: true,
    },
    // Keep-alive ping every 25s to detect stale connections on tablets/TVs
    pingInterval: 25_000,
    pingTimeout:  20_000,
  });

  registerKDSNamespace(io);
  registerPOSNamespace(io);
  registerQRNamespace(io);
  registerFleetNamespace(io);

  console.log('[Socket.IO] Server initialized with Redis adapter');
  return io;
}

/**
 * Returns the running Socket.IO instance, or null if not yet initialized.
 * Prefer the safe emit helpers below over calling this directly.
 */
export function getIO(): SocketIOServer | null {
  return io;
}

// ─── /kds Namespace ───────────────────────────────────────────────────────────

function registerKDSNamespace(io: SocketIOServer): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require('@dineiz/db') as typeof import('@dineiz/db');

  const kds = io.of('/kds');

  kds.on('connection', (socket) => {
    console.log(`[KDS] Client connected: ${socket.id}`);

    /** Join a branch-level room to receive all orders for this branch */
    socket.on('join_branch', (branchId: string) => {
      socket.join(`branch:${branchId}`);
      console.log(`[KDS] ${socket.id} joined branch:${branchId}`);
    });

    /** Join a tenant-level room to receive all orders for this tenant */
    socket.on('join_tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
      console.log(`[KDS] ${socket.id} joined tenant:${tenantId}`);
    });

    /** Join a station-specific room (e.g., Grill, Fryer) */
    socket.on('join_station', (stationId: string) => {
      socket.join(`station:${stationId}`);
      console.log(`[KDS] ${socket.id} joined station:${stationId}`);
    });

    // ── KDS Actions (client → server → all KDS/POS in branch) ────────────────

    /** PENDING → IN_KITCHEN */
    socket.on('kds:start_order', async ({ orderId, branchId }: { orderId: string; branchId: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'IN_KITCHEN' },
          include: { items: { include: { item: { select: { name: true } } } } },
        });
        kds.to(`branch:${branchId}`).emit('kds:order_updated', order);
        kds.to(`tenant:${order.tenantId}`).emit('kds:order_updated', order);
        io?.of('/pos').to(`branch:${branchId}`).emit('pos:order_started', { orderId, status: 'IN_KITCHEN' });
      } catch { socket.emit('kds:error', { orderId, message: 'Failed to start order' }); }
    });

    /** IN_KITCHEN → READY (bump) */
    socket.on('kds:bump_order', async ({ orderId, branchId }: { orderId: string; branchId: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'READY' },
          include: { items: { include: { item: { select: { name: true } } } } },
        });
        kds.to(`branch:${branchId}`).emit('kds:order_updated', order);
        kds.to(`tenant:${order.tenantId}`).emit('kds:order_updated', order);
        io?.of('/pos').to(`branch:${branchId}`).emit('pos:order_ready', order);
      } catch { socket.emit('kds:error', { orderId, message: 'Failed to bump order' }); }
    });

    /** READY → IN_KITCHEN (recall / undo bump) */
    socket.on('kds:recall_order', async ({ orderId, branchId }: { orderId: string; branchId: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'IN_KITCHEN' },
          include: { items: { include: { item: { select: { name: true } } } } },
        });
        kds.to(`branch:${branchId}`).emit('kds:order_updated', order);
        kds.to(`tenant:${order.tenantId}`).emit('kds:order_updated', order);
        io?.of('/pos').to(`branch:${branchId}`).emit('pos:order_recalled', { orderId });
      } catch { socket.emit('kds:error', { orderId, message: 'Failed to recall order' }); }
    });

    /** any → CANCELLED */
    socket.on('kds:cancel_order', async ({
      orderId, branchId, reason,
    }: { orderId: string; branchId: string; reason?: string }) => {
      try {
        const order = await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', notes: reason } });
        kds.to(`branch:${branchId}`).emit('kds:order_cancelled', { orderId, reason });
        kds.to(`tenant:${order.tenantId}`).emit('kds:order_cancelled', { orderId, reason });
        io?.of('/pos').to(`branch:${branchId}`).emit('kds:order_cancelled', { orderId, reason });
      } catch { socket.emit('kds:error', { orderId, message: 'Failed to cancel order' }); }
    });

    socket.on('disconnect', () => {
      console.log(`[KDS] Client disconnected: ${socket.id}`);

    });
  });
}

// ─── /pos Namespace ───────────────────────────────────────────────────────────

function registerPOSNamespace(io: SocketIOServer): void {
  const pos = io.of('/pos');

  pos.on('connection', (socket) => {
    console.log(`[POS] Terminal connected: ${socket.id}`);

    /** POS terminal joins its branch room to receive status updates */
    socket.on('join_branch', (branchId: string) => {
      socket.join(`branch:${branchId}`);
      console.log(`[POS] ${socket.id} joined branch:${branchId}`);
    });

    /** Dashboard can also join tenant rooms via POS namespace if needed */
    socket.on('join_tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
      console.log(`[POS] ${socket.id} joined tenant:${tenantId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[POS] Terminal disconnected: ${socket.id}`);
    });
  });
}

// ─── /qr Namespace (Waiter call) ──────────────────────────────────────────────

function registerQRNamespace(io: SocketIOServer): void {
  const qr = io.of('/qr');

  qr.on('connection', (socket) => {
    socket.on('join_branch', (branchId: string) => {
      socket.join(`branch:${branchId}`);
    });

    socket.on('waiter:call', (payload: { branchId: string; table?: string; note?: string }) => {
      const { branchId } = payload;
      // Fan out to dashboard listeners for the branch
      io.of('/pos').to(`branch:${branchId}`).emit('waiter:call', payload);
      io.of('/kds').to(`branch:${branchId}`).emit('waiter:call', payload);
      qr.to(`branch:${branchId}`).emit('waiter:call', payload);
    });
  });
}

// ─── /fleet Namespace ─────────────────────────────────────────────────────────

function registerFleetNamespace(io: SocketIOServer): void {
  const fleet = io.of('/fleet');

  fleet.on('connection', (socket) => {
    socket.on('join_branch', (branchId: string) => {
      socket.join(`branch:${branchId}`);
    });
    
    // We can allow riders to emit location directly here, but using API is also fine.
    // The instructions said PUT /api/fleet/riders/:id/location
  });
}

// ─── Emit Helpers (called from route handlers) ────────────────────────────────

/** Broadcast a new order to all KDS screens in a branch and Dashboard in tenant */
export function emitNewOrder(tenantId: string, branchId: string, order: unknown): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitNewOrder: not initialized yet'); return; }
  socket.of('/kds').to(`branch:${branchId}`).emit('kds:new_order', order);
  socket.of('/kds').to(`tenant:${tenantId}`).emit('kds:new_order', order);
  socket.of('/kds').to(`branch:${branchId}`).emit('order:created', order); // Support specific dashboard dashboard event
  socket.of('/kds').to(`tenant:${tenantId}`).emit('order:created', order);
  
  socket.of('/pos').to(`branch:${branchId}`).emit('order:created', order);
  socket.of('/pos').to(`tenant:${tenantId}`).emit('order:created', order);
}

/** Broadcast an order status update to KDS + POS in a branch and Dashboard in tenant */
export function emitOrderUpdated(tenantId: string, branchId: string, order: unknown): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitOrderUpdated: not initialized yet'); return; }
  socket.of('/kds').to(`branch:${branchId}`).emit('kds:order_updated', order);
  socket.of('/kds').to(`tenant:${tenantId}`).emit('kds:order_updated', order);
  socket.of('/pos').to(`branch:${branchId}`).emit('pos:order_ready', order);
  
  socket.of('/pos').to(`branch:${branchId}`).emit('order:status_changed', order);
  socket.of('/pos').to(`tenant:${tenantId}`).emit('order:status_changed', order);
}

/** Broadcast an order cancellation to KDS in a branch and Dashboard in tenant */
export function emitOrderCancelled(tenantId: string, branchId: string, orderId: string): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitOrderCancelled: not initialized yet'); return; }
  socket.of('/kds').to(`branch:${branchId}`).emit('kds:order_cancelled', { orderId });
  socket.of('/kds').to(`tenant:${tenantId}`).emit('kds:order_cancelled', { orderId });
}

/** Broadcast a shift lifecycle event to all POS terminals in a branch */
export function emitShiftEvent(
  branchId: string,
  event: 'opened' | 'closed',
  shiftId: string,
): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitShiftEvent: not initialized yet'); return; }
  socket.of('/pos').to(`branch:${branchId}`).emit('pos:shift_event', { event, shiftId });
}

/** Broadcast a break event to the dashboard for live shift card updates */
export function emitBreakEvent(
  branchId: string,
  tenantId: string,
  event: 'started' | 'ended' | 'long_break',
  payload: { shiftId: string; cashierName?: string; breakId?: string; durationMinutes?: number },
): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitBreakEvent: not initialized yet'); return; }
  socket.of('/kds').to(`branch:${branchId}`).emit('shift:break_event', { event, ...payload });
  socket.of('/kds').to(`tenant:${tenantId}`).emit('shift:break_event', { event, ...payload });
}

/** Broadcast to a specific station (e.g., only the Grill KDS) */
export function emitToStation(stationId: string, event: string, data: unknown): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitToStation: not initialized yet'); return; }
  socket.of('/kds').to(`station:${stationId}`).emit(event, data);
}

/** Broadcast table status change to POS terminals in a branch and Dashboard in tenant */
export function emitTableStatusChanged(
  branchId: string, 
  data: { tableId: string, status: 'free' | 'occupied' | 'ready', orderId?: string, since?: string },
  tenantId?: string
): void {
  const socket = getIO();
  if (!socket) { console.warn('[Socket.IO] emitTableStatusChanged: not initialized yet'); return; }
  socket.of('/pos').to(`branch:${branchId}`).emit('table:status_changed', data);
  if (tenantId) {
    socket.of('/pos').to(`tenant:${tenantId}`).emit('table:status_changed', data);
  }
}

/** Broadcast branding update to POS terminals in a tenant */
export function emitBrandingUpdated(tenantId: string, branding: Record<string, any>): void {
  const socket = getIO();
  if (!socket) { return; }
  // /pos is the only namespace any client actually listens on for this
  // event — the previous unscoped socket.emit() fallback landed on the
  // default namespace, which nothing subscribes to, so it was dead code.
  socket.of('/pos').to(`tenant:${tenantId}`).emit('tenant:branding_updated', branding);
}

/** Broadcast menu price changes to POS terminals */
export function emitMenuPriceChanged(tenantId: string, branchId: string | null, data: { itemId?: string, variationId?: string, price: number }): void {
  const socket = getIO();
  if (!socket) { return; }
  if (branchId) {
    socket.of('/pos').to(`branch:${branchId}`).emit('menu:price_changed', data);
  } else {
    socket.of('/pos').to(`tenant:${tenantId}`).emit('menu:price_changed', data);
  }
}

export function emitRiderLocationUpdated(branchId: string, data: { riderId: string, lat: number, lng: number }): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/fleet').to(`branch:${branchId}`).emit('rider:location_updated', data);
}

export function emitRiderStatusChanged(branchId: string, data: { riderId: string, newStatus: string, delivery?: any }): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/fleet').to(`branch:${branchId}`).emit('rider:status_changed', data);
}

export function emitDeliveryStageUpdated(branchId: string, data: { riderId: string, stage: string }): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/fleet').to(`branch:${branchId}`).emit('delivery:stage_updated', data);
}

export function emitDashboardStatsUpdated(tenantId: string, branchId: string): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/kds').to(`branch:${branchId}`).emit('dashboard:stats_updated');
  socket.of('/kds').to(`tenant:${tenantId}`).emit('dashboard:stats_updated');
}

/** Broadcast that one or more ingredients' stock changed for a branch (any cause). */
export function emitInventoryUpdated(tenantId: string, branchId: string, ingredientIds: string[]): void {
  const socket = getIO();
  if (!socket) { return; }
  const payload = { branchId, ingredientIds };
  socket.of('/pos').to(`branch:${branchId}`).emit('inventory:updated', payload);
  socket.of('/kds').to(`branch:${branchId}`).emit('inventory:updated', payload);
  socket.of('/pos').to(`tenant:${tenantId}`).emit('inventory:updated', payload);
}

/** Broadcast that an ingredient crossed below its reorder threshold. */
export function emitLowStock(data: {
  branchId: string; ingredientId: string; name: string; currentQty: number;
  unit: string; threshold: number; affectedItems: string[];
}): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/pos').to(`branch:${data.branchId}`).emit('inventory:low_stock', data);
}

/** Broadcast that an ingredient hit zero (or below). */
export function emitOutOfStock(data: {
  branchId: string; ingredientId: string; name: string; affectedItems: { id: string; name: string }[];
}): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/pos').to(`branch:${data.branchId}`).emit('inventory:out_of_stock', data);
}

/** Broadcast that a menu item was auto-disabled at a branch because a required ingredient ran out. */
export function emitMenuItemUnavailable(branchId: string, itemId: string, itemName: string): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/pos').to(`branch:${branchId}`).emit('menu:item_unavailable', { itemId, itemName, reason: 'OUT_OF_STOCK' });
}

/** Broadcast that a previously auto-disabled menu item is available again. */
export function emitMenuItemAvailable(branchId: string, itemId: string, itemName: string): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/pos').to(`branch:${branchId}`).emit('menu:item_available', { itemId, itemName });
}

/** Broadcast that a purchase order was received (fully or partially). */
export function emitPoReceived(branchId: string, data: { poNumber: string; itemCount: number }): void {
  const socket = getIO();
  if (!socket) { return; }
  socket.of('/pos').to(`branch:${branchId}`).emit('inventory:po_received', data);
}
