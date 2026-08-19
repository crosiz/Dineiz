import { prisma } from '@dineiz/db';
import { updateOrder } from '../order/order.service';
import { DeliveryAssignmentStatus, OrderStatus } from '@prisma/client';

export async function listDeliveries(tenantId: string, branchId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.order.findMany({
    where: {
      tenantId,
      branchId,
      type: 'DELIVERY',
      createdAt: { gte: startOfToday },
    },
    include: {
      items: { include: { item: { select: { name: true } } } },
      customer: true,
      riderAssignment: {
        include: {
          rider: { select: { id: true, name: true, phone: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listRiders(tenantId: string, branchId: string) {
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
      role: true,
      status: true,
    }
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Get active and completed assignments for today
  const assignments = await prisma.riderAssignment.findMany({
    where: {
      tenantId,
      riderId: { in: riders.map(r => r.id) },
      createdAt: { gte: startOfToday }
    }
  });

  return riders.map(rider => {
    const riderAssignments = assignments.filter(a => a.riderId === rider.id);
    const active = riderAssignments.filter(a => ['ASSIGNED', 'PICKED_UP'].includes(a.status)).length;
    const completed = riderAssignments.filter(a => a.status === 'COMPLETED').length;

    return {
      ...rider,
      activeDeliveries: active,
      completedDeliveries: completed,
      status: rider.status === 'ACTIVE' ? 'ON_DUTY' : 'OFF_DUTY',
    };
  });
}

export async function createRider(tenantId: string, branchId: string, data: { name: string; phone: string; passcode: string }) {
  // Check if phone exists
  const existing = await prisma.user.findFirst({ where: { phone: data.phone } });
  if (existing) {
    throw new Error('Phone number already in use');
  }

  return prisma.user.create({
    data: {
      tenantId,
      branchId,
      name: data.name,
      phone: data.phone,
      posPin: data.passcode, // Needs hashing in real app, assuming simple PIN for now
      role: 'RIDER',
      status: 'ACTIVE',
    }
  });
}

export async function assignRider(tenantId: string, orderId: string, riderId: string) {
  const assignment = await prisma.riderAssignment.upsert({
    where: { orderId },
    create: {
      tenantId,
      orderId,
      riderId,
      status: 'ASSIGNED',
      assignedAt: new Date(),
    },
    update: {
      riderId,
      status: 'ASSIGNED',
      assignedAt: new Date(),
    },
    include: {
      order: { select: { branchId: true } },
      rider: { select: { id: true, name: true, phone: true } }
    }
  });

  const { getIO } = await import('../../lib/socket.js');
  const io = getIO();
  if (io) {
    // /fleet is the namespace the dashboard's Fleet page and rider clients
    // actually connect to (matching emitRiderLocationUpdated etc.) — this
    // was landing on the default namespace, where nothing listens.
    io.of('/fleet').to(`branch:${assignment.order.branchId}`).emit('delivery:status_changed', { orderId, assignment });
  }

  return assignment;
}

export async function updateDeliveryStatus(tenantId: string, orderId: string, status: DeliveryAssignmentStatus) {
  const existing = await prisma.riderAssignment.findUnique({
    where: { orderId },
    include: { order: true }
  });

  if (!existing) {
    throw new Error('Delivery assignment not found');
  }

  const updateData: any = { status };
  if (status === 'PICKED_UP') updateData.pickedUpAt = new Date();
  if (status === 'COMPLETED') updateData.completedAt = new Date();

  const assignment = await prisma.riderAssignment.update({
    where: { orderId },
    data: updateData,
    include: {
      order: { select: { branchId: true } },
      rider: { select: { id: true, name: true, phone: true } }
    }
  });

  if (status === 'COMPLETED') {
    // If delivery is complete, complete the order
    await updateOrder(tenantId, orderId, { status: OrderStatus.COMPLETED });
  }

  const { getIO } = await import('../../lib/socket.js');
  const io = getIO();
  if (io) {
    // /fleet is the namespace the dashboard's Fleet page and rider clients
    // actually connect to (matching emitRiderLocationUpdated etc.) — this
    // was landing on the default namespace, where nothing listens.
    io.of('/fleet').to(`branch:${assignment.order.branchId}`).emit('delivery:status_changed', { orderId, assignment });
  }

  return assignment;
}
