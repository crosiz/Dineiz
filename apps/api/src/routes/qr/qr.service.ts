import { prisma, OrderStatus, OrderType } from '@dineiz/db';
import { emitNewOrder } from '../../lib/socket';

export async function getSettings(tenantId: string) {
  let settings = await prisma.qrSettings.findUnique({ where: { tenantId } });
  if (!settings) {
    settings = await prisma.qrSettings.create({
      data: { tenantId }
    });
  }
  return settings;
}

export async function saveSettings(tenantId: string, data: any) {
  // Only update safe fields
  const safeData = {
    isEnabled: data.isEnabled,
    allowModifications: data.allowModifications,
    showImages: data.showImages,
    language: data.language,
    autoConfirm: data.autoConfirm,
    allowOnlinePayment: data.allowOnlinePayment,
    qrStyle: data.qrStyle,
    qrColor: data.qrColor,
    showLogoInQr: data.showLogoInQr,
    heroImage: data.heroImage,
    welcomeMessage: data.welcomeMessage,
    footerMessage: data.footerMessage,
  };

  const settings = await prisma.qrSettings.upsert({
    where: { tenantId },
    update: safeData,
    create: { ...safeData, tenantId }
  });
  return settings;
}

function generateOrderNumber() {
  return `QR-${Date.now().toString().slice(-6)}`;
}

export async function handleCreateOrder(data: any) {
  const { tenantId, branchId, tableId, customerName, notes, items, paymentMethod } = data;
  
  // 1. Validate settings
  const settings = await prisma.qrSettings.findUnique({ where: { tenantId } });
  if (!settings || !settings.isEnabled) {
    throw new Error('QR Ordering is disabled for this restaurant.');
  }

  // 2. Resolve items & prices
  const itemIds = items.map((i: any) => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds }, tenantId }
  });

  if (dbItems.length !== items.length) {
    throw new Error('Some items are invalid or unavailable.');
  }

  let totalAmount = 0;
  const orderItemsData = items.map((clientItem: any) => {
    const dbItem = dbItems.find(i => i.id === clientItem.itemId);
    const price = dbItem!.basePrice;
    const subtotal = price * clientItem.quantity;
    totalAmount += subtotal;

    return {
      itemId: dbItem!.id,
      quantity: clientItem.quantity,
      unitPrice: price,
      subtotal,
      notes: settings.allowModifications ? clientItem.notes : undefined
    };
  });

  // 3. Status and Payment logic
  const status: OrderStatus = settings.autoConfirm ? 'IN_KITCHEN' : 'PENDING';
  
  // Create order
  const order = await prisma.order.create({
    data: {
      tenantId,
      branchId,
      tableId,
      orderNumber: generateOrderNumber(),
      source: 'QR_CODE',
      type: 'DINE_IN', // QR implies table ordering in this context
      status,
      totalAmount,
      netAmount: totalAmount,
      taxAmount: 0,
      discountAmount: 0,
      notes: notes ? `QR Customer Notes: ${notes}` : null,
      items: {
        create: orderItemsData
      }
    },
    include: { items: true, table: true }
  });

  // Handle mock payment if online payment is enabled and requested
  if (settings.allowOnlinePayment && paymentMethod === 'ONLINE') {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: totalAmount,
        method: 'ONLINE',
        status: 'COMPLETED'
      }
    });
  }

  // 4. Emit real-time notification
  try {
    emitNewOrder(tenantId, branchId, order);
  } catch (err) {
    console.error('[QR] Failed to emit order:created socket event', err);
  }

  return order;
}
