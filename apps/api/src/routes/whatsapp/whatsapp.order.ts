import { prisma, WhatsAppConversation } from '@dineiz/db';
import { emitNewOrder } from '../../lib/socket';
import { cartTotal, CartLine } from './whatsapp.state-machine';
import { nextNonPosOrderNumber, type OrderNumberFormat } from '../../lib/orderNumber';

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s-]/g, '');
  if (p.startsWith('03')) p = '+923' + p.slice(2);
  else if (!p.startsWith('+')) p = '+' + p;
  return p;
}

/**
 * Creates the real Order from a conversation that has reached SELECTING_PAYMENT
 * and just confirmed cash-on-delivery/cash-at-counter. Mirrors the aggregator
 * order pipeline (aggregators.service.ts) rather than the POS createOrder()
 * service, which assumes a logged-in cashier/shift that a WhatsApp order
 * doesn't have.
 */
export async function createOrderFromConversation(
  conversation: WhatsAppConversation,
  cart: CartLine[],
) {
  const total = cartTotal(cart);
  const phone = normalizePhone(conversation.phoneNumber);

  const customer = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: conversation.tenantId, phone } },
    create: {
      tenantId: conversation.tenantId,
      name: conversation.customerName ?? 'WhatsApp Customer',
      phone,
      totalOrders: 1,
      totalSpend: total,
      lastVisitAt: new Date(),
    },
    update: {
      name: conversation.customerName ?? undefined,
      totalOrders: { increment: 1 },
      totalSpend: { increment: total },
      lastVisitAt: new Date(),
    },
  });

  const waBranding = await prisma.tenantBranding.findUnique({
    where: { tenantId: conversation.tenantId },
    select: { orderNumberFormat: true, tenantShortCode: true },
  });
  const orderNumber = await nextNonPosOrderNumber({
    tenantId: conversation.tenantId,
    source: 'WHATSAPP',
    format: (waBranding?.orderNumberFormat as OrderNumberFormat) ?? 'STANDARD',
    shortCode: waBranding?.tenantShortCode,
  });

  const order = await prisma.order.create({
    data: {
      tenantId: conversation.tenantId,
      branchId: conversation.branchId,
      orderNumber,
      source: 'WHATSAPP',
      type: conversation.orderType ?? 'TAKEAWAY',
      status: 'PENDING',
      totalAmount: total,
      netAmount: total,
      taxAmount: 0,
      discountAmount: 0,
      deliveryAddress: conversation.orderType === 'DELIVERY' ? conversation.deliveryAddress : null,
      customerId: customer.id,
      notes: 'WhatsApp order',
      items: {
        create: cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.qty,
          unitPrice: c.unitPrice,
          subtotal: c.unitPrice * c.qty,
          notes: c.note ?? undefined,
          options: c.variationName ? { variationId: c.variationId, variationName: c.variationName } : undefined,
        })),
      },
      payments: {
        create: [{ method: 'CASH', amount: total, status: 'PENDING' }],
      },
    },
    include: { items: true, payments: true },
  });

  try {
    emitNewOrder(conversation.tenantId, conversation.branchId, order);
  } catch (err) {
    console.error('[WhatsApp] Socket emission failed', err);
  }

  return order;
}
