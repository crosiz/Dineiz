import { prisma, WhatsAppConfig, WhatsAppConversationStage } from '@dineiz/db';
import { parseIntent } from './whatsapp.ai';
import { advance, buildOrderPlacedMessage, ConversationView, MenuItemView, MenuView, CartLine } from './whatsapp.state-machine';
import { createOrderFromConversation } from './whatsapp.order';
import { sendMessage } from './whatsapp.wa-client';
import type { WhatsAppConfigUpdateSchema } from './whatsapp.schema';
import type { z } from 'zod';

const ACTIVE_STAGES: WhatsAppConversationStage[] = [
  'GREETING', 'BROWSING_MENU', 'BUILDING_ORDER', 'COLLECTING_ORDER_TYPE',
  'COLLECTING_ADDRESS', 'SELECTING_PAYMENT', 'CONFIRMED',
];

export async function getConfig(tenantId: string) {
  const existing = await prisma.whatsAppConfig.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.whatsAppConfig.create({ data: { tenantId } });
}

export async function updateConfig(tenantId: string, data: z.infer<typeof WhatsAppConfigUpdateSchema>) {
  // operatingHours is a plain object against a Prisma Json field — Prisma's
  // generated input types don't accept a concrete object shape there, so it
  // needs an `any` escape hatch (same friction every Json-field write in
  // this codebase has).
  return prisma.whatsAppConfig.upsert({
    where: { tenantId },
    update: data as any,
    create: { tenantId, ...data } as any,
  });
}

export async function listConversations(tenantId: string, status: 'active' | 'all', limit: number) {
  return prisma.whatsAppConversation.findMany({
    where: { tenantId, ...(status === 'active' ? { stage: { in: ACTIVE_STAGES } } : {}) },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    include: { customer: { select: { name: true, phone: true } } },
  });
}

async function loadMenu(tenantId: string, branchId: string, config: WhatsAppConfig): Promise<MenuView> {
  const categories = await prisma.category.findMany({
    where: {
      tenantId,
      ...(config.visibleCategoryIds.length ? { id: { in: config.visibleCategoryIds } } : {}),
    },
    include: {
      items: {
        where: { isAvailable: true },
        include: {
          variations: true,
          branchMenuItems: { where: { branchId } },
        },
      },
      branchMenuCategories: { where: { branchId } },
    },
  });

  const items: MenuItemView[] = [];
  for (const cat of categories) {
    const catOverride = cat.branchMenuCategories[0];
    if (catOverride && !catOverride.isAvailable) continue;

    for (const item of cat.items) {
      // A branch-specific row (if one exists) is authoritative; no row means
      // "use the tenant-level Item.isAvailable" (already filtered above).
      const itemOverride = item.branchMenuItems[0];
      if (itemOverride && (!itemOverride.isAvailable || !itemOverride.isInStock)) continue;

      items.push({
        id: item.id,
        name: item.name,
        basePrice: itemOverride?.overridePrice ?? item.basePrice,
        categoryId: cat.id,
        categoryName: cat.name,
        variations: item.variations.map((v) => ({ id: v.id, name: v.name, price: v.price })),
      });
    }
  }
  return { items };
}

/**
 * Persists an inbound Meta message and either handles it inline (blocked
 * number, unsupported message type) or leaves it for the queue worker.
 * Returns the message id to enqueue, or null if nothing further to do.
 */
export async function ingestInboundMessage(config: WhatsAppConfig, msg: any): Promise<{ messageId: string } | null> {
  const phoneNumber: string = msg.from;
  if (!phoneNumber) return null;

  const blocked = await prisma.whatsAppBlocklist.findUnique({
    where: { tenantId_phoneNumber: { tenantId: config.tenantId, phoneNumber } },
  });
  if (blocked) return null;

  if (!config.defaultBranchId) return null; // bot enabled but not assigned to a branch yet

  let conversation = await prisma.whatsAppConversation.findFirst({
    where: { tenantId: config.tenantId, phoneNumber, stage: { in: ACTIVE_STAGES } },
  });
  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: { tenantId: config.tenantId, branchId: config.defaultBranchId, phoneNumber, stage: 'GREETING' },
    });
  }

  const text: string | null =
    msg.text?.body ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;
  const isSupportedType = msg.type === 'text' || msg.type === 'interactive' || msg.type === 'button';

  const message = await prisma.whatsAppMessage.create({
    data: {
      tenantId: config.tenantId,
      conversationId: conversation.id,
      direction: 'IN',
      body: isSupportedType ? text : null,
      rawPayload: msg,
    },
  });

  if (!isSupportedType || !text) {
    // EC1/EC2 — photo/voice/document messages: reply generically, no AI call.
    await sendMessage(config, phoneNumber, `Sorry, I can only understand text messages. Please type what you'd like to order.`);
    await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { processedAt: new Date() } });
    return null;
  }

  return { messageId: message.id };
}

/**
 * Full pipeline for one inbound message: load context, ask the AI (or fall
 * back to keyword matching), advance the conversation state machine, create
 * the order if this message completed a COD checkout, and reply.
 */
export async function processInboundMessage(messageId: string) {
  const message = await prisma.whatsAppMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });
  if (!message || message.processedAt) return;

  try {
    const conversation = message.conversation;
    const config = await prisma.whatsAppConfig.findUnique({ where: { tenantId: conversation.tenantId } });
    if (!config || !config.isEnabled) {
      await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { processedAt: new Date() } });
      return;
    }

    const menu = await loadMenu(conversation.tenantId, conversation.branchId, config);

    const recentMessages = await prisma.whatsAppMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const historyContext = recentMessages
      .reverse()
      .map((m) => `${m.direction === 'IN' ? 'Customer' : 'Bot'}: ${m.body ?? ''}`)
      .join('\n');

    const cart = ((conversation.cartJson as unknown as CartLine[]) ?? []);
    const menuContext = menu.items.map((i) => `${i.name} — PKR ${i.basePrice}`).join('\n');

    const intent = await parseIntent(
      message.body ?? '',
      menuContext,
      historyContext,
      cart.map((c) => ({ itemName: c.itemName, qty: c.qty })),
    );

    await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { aiIntent: intent as any } });

    const conversationView: ConversationView = {
      stage: conversation.stage,
      cart,
      orderType: conversation.orderType,
      deliveryAddress: conversation.deliveryAddress,
    };

    const result = advance(
      conversationView,
      intent,
      { botName: config.botName, minOrderAmount: config.minOrderAmount, allowedOrderTypes: config.allowedOrderTypes },
      menu,
    );

    let replyText = result.replyText;
    let orderId = conversation.orderId;
    let finalStage = result.nextStage;

    if (result.shouldCreateOrder) {
      const order = await createOrderFromConversation(
        { ...conversation, orderType: result.orderType, deliveryAddress: result.deliveryAddress },
        result.cart,
      );
      orderId = order.id;
      // COMPLETED (not the transient CONFIRMED) so the next inbound message
      // from this number starts a fresh conversation rather than being
      // treated as still "active" against a conversation that already has
      // an order.
      finalStage = 'COMPLETED';
      replyText = buildOrderPlacedMessage(order.orderNumber, result.orderType ?? 'TAKEAWAY');
    }

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        stage: finalStage,
        cartJson: result.cart as any,
        orderType: result.orderType,
        deliveryAddress: result.deliveryAddress,
        orderId,
        lastMessageAt: new Date(),
      },
    });

    if (replyText) {
      await sendMessage(config, conversation.phoneNumber, replyText);
      await prisma.whatsAppMessage.create({
        data: {
          tenantId: conversation.tenantId,
          conversationId: conversation.id,
          direction: 'OUT',
          body: replyText,
          rawPayload: { text: replyText },
        },
      });
    }

    await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { processedAt: new Date() } });
  } catch (err: any) {
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: { processError: String(err?.message ?? err) },
    });
    throw err;
  }
}
