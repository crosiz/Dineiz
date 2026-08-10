import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@dineiz/db';
import { redis } from '../../lib/redis';
import { 
  emitRiderLocationUpdated, 
  emitRiderStatusChanged, 
  emitDeliveryStageUpdated 
} from '../../lib/socket';
import { listDeliveries, listRiders, createRider, assignRider, updateDeliveryStatus } from './fleet.service';

const LOCATION_PREFIX = 'rider:loc:';

interface GetRidersQuery {
  tenantId: string;
  branchId: string;
  status?: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE';
}

export async function getRidersHandler(
  request: FastifyRequest<{ Querystring: GetRidersQuery }>,
  reply: FastifyReply
) {
  const { tenantId, branchId, status } = request.query;

  if (!tenantId || !branchId) {
    return reply.status(400).send({ error: 'tenantId and branchId are required' });
  }

  // Find all riders for the given branch
  const riders = await prisma.user.findMany({
    where: {
      tenantId,
      branchId,
      role: 'RIDER',
    },
    select: {
      id: true,
      name: true,
      phone: true,
      avatarColor: true,
      status: true,
      riderAssignments: {
        where: {
          status: { in: ['ASSIGNED', 'PICKED_UP'] }
        },
        include: {
          order: true
        }
      }
    }
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch today's completed assignments for stats
  const completedAssignments = await prisma.riderAssignment.findMany({
    where: {
      tenantId,
      riderId: { in: riders.map(r => r.id) },
      status: 'COMPLETED',
      updatedAt: { gte: startOfDay }
    }
  });

  const parsedRiders = await Promise.all(riders.map(async (rider) => {
    // Determine status
    let computedStatus: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE' = rider.status === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE';
    
    let currentDelivery = null;
    const activeAssignment = rider.riderAssignments[0];
    
    if (activeAssignment) {
      computedStatus = 'ON_DELIVERY';
      const order = activeAssignment.order;
      currentDelivery = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.notes?.includes('customer:') ? order.notes.split('customer:')[1].trim() : 'Customer', // best effort without customer relation
        etaMinutes: Math.round((order.deliveryEtaSec || 1800) / 60),
        distanceKm: 2.5, // Mocked or calculated if we have branch location
        stage: activeAssignment.status === 'ASSIGNED' ? 'EN_ROUTE' : activeAssignment.status === 'PICKED_UP' ? 'PICKED_UP' : 'COMPLETED',
        destinationLat: order.deliveryLat || 24.8607,
        destinationLng: order.deliveryLng || 67.0011,
      };
    }

    // Get location from Redis
    const locStr = await redis.get(`${LOCATION_PREFIX}${rider.id}`);
    let location = null;
    if (locStr) {
      try {
        location = JSON.parse(locStr);
      } catch (e) {}
    }

    // Calculate today's stats
    const riderCompleted = completedAssignments.filter(a => a.riderId === rider.id);
    const deliveries = riderCompleted.length;
    const earnings = deliveries * 200; // Mock: PKR 200 per delivery
    const rating = 4.8; // Mock rating

    return {
      id: rider.id,
      name: rider.name,
      phone: rider.phone || '',
      avatarInitials: rider.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
      avatarColor: rider.avatarColor || '#FF5722',
      status: computedStatus,
      zone: 'Downtown Zone', // Mocked or from delivery zones
      currentDelivery,
      location,
      todayStats: {
        deliveries,
        earnings,
        rating
      }
    };
  }));

  const filteredRiders = status 
    ? parsedRiders.filter(r => r.status === status)
    : parsedRiders;

  const total = parsedRiders.length;
  const available = parsedRiders.filter(r => r.status === 'AVAILABLE').length;
  const onDelivery = parsedRiders.filter(r => r.status === 'ON_DELIVERY').length;
  const offline = parsedRiders.filter(r => r.status === 'OFFLINE').length;
  const activeDeliveries = onDelivery;
  const avgDeliveryTimeMin = 28; // Mocked

  return reply.send({
    summary: {
      total,
      available,
      onDelivery,
      offline,
      activeDeliveries,
      avgDeliveryTimeMin
    },
    riders: filteredRiders
  });
}

export async function assignOrderHandler(
  request: FastifyRequest<{ Body: { orderId: string, riderId: string } }>,
  reply: FastifyReply
) {
  const { orderId, riderId } = request.body;

  // Validate rider is available
  const rider = await prisma.user.findUnique({
    where: { id: riderId },
    include: { riderAssignments: { where: { status: { in: ['ASSIGNED', 'PICKED_UP'] } } } }
  });

  if (!rider || rider.role !== 'RIDER') {
    return reply.status(400).send({ error: 'Invalid rider' });
  }
  if (rider.riderAssignments.length > 0) {
    return reply.status(400).send({ error: 'Rider is already on a delivery' });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'READY') {
    return reply.status(400).send({ error: 'Order is not READY for delivery' });
  }

  const assignment = await prisma.riderAssignment.create({
    data: {
      tenantId: order.tenantId,
      orderId,
      riderId,
      status: 'ASSIGNED',
      assignedAt: new Date()
    }
  });

  const branchId = order.branchId;

  // Emit status change
  emitRiderStatusChanged(branchId, {
    riderId,
    newStatus: 'ON_DELIVERY',
    delivery: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: 'Customer', // mock
      etaMinutes: 15,
      distanceKm: 2.5,
      stage: 'EN_ROUTE',
      destinationLat: order.deliveryLat,
      destinationLng: order.deliveryLng
    }
  });

  return reply.send({ success: true, assignment });
}

export async function updateRiderLocationHandler(
  request: FastifyRequest<{ Params: { id: string }, Body: { lat: number, lng: number } }>,
  reply: FastifyReply
) {
  const riderId = request.params.id;
  const { lat, lng } = request.body;

  // Basic Rate limiting: ensure we only update Redis at most once per second per rider
  const lastUpdateKey = `rlmt:${riderId}`;
  const lastUpdate = await redis.get(lastUpdateKey);
  if (lastUpdate) {
    return reply.status(429).send({ error: 'Rate limit exceeded (1 req/sec)' });
  }
  await redis.set(lastUpdateKey, '1', 'PX', 1000);

  // Store in Redis with no expiry (or set 1 day expiry)
  await redis.set(`${LOCATION_PREFIX}${riderId}`, JSON.stringify({ lat, lng }), 'EX', 86400);

  const rider = await prisma.user.findUnique({ where: { id: riderId } });
  if (rider && rider.branchId) {
    emitRiderLocationUpdated(rider.branchId, { riderId, lat, lng });
  }

  return reply.send({ success: true });
}

export async function updateDeliveryStageHandler(
  request: FastifyRequest<{ Params: { id: string }, Body: { stage: 'PICKED_UP' | 'EN_ROUTE' | 'COMPLETED' } }>,
  reply: FastifyReply
) {
  const riderId = request.params.id;
  const { stage } = request.body;

  const assignment = await prisma.riderAssignment.findFirst({
    where: {
      riderId,
      status: { in: ['ASSIGNED', 'PICKED_UP'] }
    },
    include: { order: true }
  });

  if (!assignment) {
    return reply.status(404).send({ error: 'Active assignment not found' });
  }

  const branchId = assignment.order.branchId;

  if (stage === 'COMPLETED') {
    await prisma.riderAssignment.update({
      where: { id: assignment.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    await prisma.order.update({
      where: { id: assignment.orderId },
      data: { status: 'COMPLETED' }
    });
    
    emitDeliveryStageUpdated(branchId, { riderId, stage });
    
    // Broadcast status change back to AVAILABLE after 30 seconds
    setTimeout(() => {
      emitRiderStatusChanged(branchId, { riderId, newStatus: 'AVAILABLE' });
    }, 30000);

  } else {
    // EN_ROUTE or PICKED_UP
    const statusMap = {
      'PICKED_UP': 'PICKED_UP',
      'EN_ROUTE': 'ASSIGNED' // map en_route to ASSIGNED if needed, or keep PICKED_UP
    } as const;

    await prisma.riderAssignment.update({
      where: { id: assignment.id },
      data: { 
        status: statusMap[stage] || 'PICKED_UP',
        pickedUpAt: stage === 'PICKED_UP' ? new Date() : undefined
      }
    });

    emitDeliveryStageUpdated(branchId, { riderId, stage });
  }

  return reply.send({ success: true });
}

export async function getUnassignedOrdersHandler(
  request: FastifyRequest<{ Querystring: { branchId: string } }>,
  reply: FastifyReply
) {
  const { branchId } = request.query;

  if (!branchId) {
    return reply.status(400).send({ error: 'branchId is required' });
  }

  const orders = await prisma.order.findMany({
    where: {
      branchId,
      type: 'DELIVERY',
      status: 'READY',
      riderAssignment: null // no assignment
    }
  });

  return reply.send(orders);
}

// ---- Web Dashboard Handlers ----

export async function handleListDeliveries(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const q = request.query as { branchId: string };
  const branchId = (request.scopedBranchId ?? undefined) || q.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  const deliveries = await listDeliveries(tenantId, branchId);
  return reply.send(deliveries);
}

export async function handleListRiders(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user!.tenantId!;
  const q = request.query as { branchId: string };
  const branchId = (request.scopedBranchId ?? undefined) || q.branchId;
  if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
  const riders = await listRiders(tenantId, branchId);
  return reply.send(riders);
}

export async function handleCreateRider(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const q = request.query as { branchId: string };
    const branchId = (request.scopedBranchId ?? undefined) || q.branchId;
    const data = request.body as any;
    if (!branchId) return reply.status(400).send({ error: 'branchId is required' });
    const rider = await createRider(tenantId, branchId, data);
    return reply.status(201).send(rider);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleAssignRider(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { orderId } = request.params as any;
    const { riderId } = request.body as any;
    const assignment = await assignRider(tenantId, orderId, riderId);
    return reply.send(assignment);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}

export async function handleUpdateDeliveryStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const tenantId = request.user!.tenantId!;
    const { orderId } = request.params as any;
    const { status } = request.body as any;
    const assignment = await updateDeliveryStatus(tenantId, orderId, status);
    return reply.send(assignment);
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
}
