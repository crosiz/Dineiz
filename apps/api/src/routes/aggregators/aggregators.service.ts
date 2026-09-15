import { prisma, AggregatorWebhookEvent, OrderSource, OrderType, OrderStatus } from '@dineiz/db';
import { emitNewOrder } from '../../lib/socket';
import { nextNonPosOrderNumber, type OrderNumberFormat } from '../../lib/orderNumber';

export async function handleWebhookPayload(event: AggregatorWebhookEvent) {
  const { tenantId, provider, payload } = event;
  const data = payload as any;
  const externalOrderId = data?.data?.orderId || data?.orderId || `ext-${Date.now()}`;
  
  const integration = await prisma.aggregatorIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider } }
  });
  
  if (!integration || integration.status !== 'CONNECTED') {
    throw new Error(`Integration for ${provider} is not connected or missing.`);
  }

  const targetBranchId = integration.branchId;
  if (!targetBranchId) {
    throw new Error(`No default branch assigned for ${provider} integration.`);
  }

  const incomingItems: any[] = data?.data?.items || data?.items || [];
  let totalAmount = 0;
  const orderItemsData: any[] = [];
  
  for (const item of incomingItems) {
    const extId = String(item.id || item.aggregatorItemId);
    const extName = item.name || item.aggregatorItemName || 'Unknown Item';
    const extPrice = Number(item.price || item.unitPrice || 0);
    const qty = Number(item.quantity || 1);

    let mapping = await prisma.aggregatorMenuMapping.findUnique({
      where: { tenantId_provider_aggregatorItemId: { tenantId, provider, aggregatorItemId: extId } },
      include: { item: true }
    });

    if (!mapping) {
      mapping = await prisma.aggregatorMenuMapping.create({
        data: {
          tenantId,
          provider,
          aggregatorItemId: extId,
          aggregatorItemName: extName,
        },
        include: { item: true }
      });
    }

    if (!mapping.itemId || !mapping.item) {
      throw new Error(`Item "${extName}" (ID: ${extId}) is not mapped. Mapped items are required to accept orders.`);
    }

    let finalPrice = extPrice;
    if (mapping.priceModifier) {
      finalPrice = mapping.item.basePrice * (1 + mapping.priceModifier / 100);
    }

    const subtotal = finalPrice * qty;
    totalAmount += subtotal;

    orderItemsData.push({
      itemId: mapping.itemId,
      quantity: qty,
      unitPrice: finalPrice,
      subtotal: subtotal,
      notes: item.notes || `Aggregator Item ID: ${extId}`
    });
  }

  const sourceMap: Record<string, OrderSource> = {
    foodpanda: 'FOODPANDA',
    careem: 'CAREEM',
    talabat: 'TALABAT'
  };
  const orderSource = sourceMap[provider] || 'POS';

  const status = integration.autoAccept ? 'CONFIRMED' : 'PENDING';

  // Part 4 — one generator. Non-POS sources run through the shared formatter
  // so a Foodpanda order reads "F-0912-001", same shape as everything else.
  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId },
    select: { orderNumberFormat: true, tenantShortCode: true },
  });
  const orderNumber = await nextNonPosOrderNumber({
    tenantId,
    source: orderSource,
    format: (branding?.orderNumberFormat as OrderNumberFormat) ?? 'STANDARD',
    shortCode: branding?.tenantShortCode,
  });

  const order = await prisma.order.create({
    data: {
      tenantId,
      branchId: targetBranchId,
      orderNumber,
      source: orderSource,
      type: 'DELIVERY',
      status: status as OrderStatus,
      totalAmount,
      netAmount: totalAmount,
      taxAmount: 0,
      discountAmount: 0,
      notes: `Aggregator Order ID: ${externalOrderId}`,
      items: {
        create: orderItemsData
      }
    },
    include: {
      items: true
    }
  });

  try {
    emitNewOrder(tenantId, targetBranchId, order);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  return order;
}
