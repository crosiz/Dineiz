import type { OrderType, WhatsAppConversationStage } from '@dineiz/db';
import type { ParsedIntent } from './whatsapp.ai';

export interface MenuItemView {
  id: string;
  name: string;
  basePrice: number;
  categoryId: string;
  categoryName: string;
  variations: Array<{ id: string; name: string; price: number }>;
}

export interface MenuView {
  items: MenuItemView[];
}

export interface CartLine {
  itemId: string;
  itemName: string;
  variationId: string | null;
  variationName: string | null;
  qty: number;
  unitPrice: number;
  note: string | null;
}

export interface ConversationView {
  stage: WhatsAppConversationStage;
  cart: CartLine[];
  orderType: OrderType | null;
  deliveryAddress: string | null;
}

export interface WhatsAppConfigView {
  botName: string;
  minOrderAmount: number;
  allowedOrderTypes: string[]; // subset of ["TAKEAWAY", "DELIVERY"]
}

export interface AdvanceResult {
  nextStage: WhatsAppConversationStage;
  cart: CartLine[];
  orderType: OrderType | null;
  deliveryAddress: string | null;
  replyText: string;
  shouldCreateOrder: boolean;
}

const normalize = (s: string) => s.toLowerCase().trim();

function matchMenuItem(name: string, menu: MenuView): MenuItemView | null {
  const n = normalize(name);
  if (!n) return null;
  const exact = menu.items.find((i) => normalize(i.name) === n);
  if (exact) return exact;
  return menu.items.find((i) => normalize(i.name).includes(n) || n.includes(normalize(i.name))) ?? null;
}

function matchCartLine(name: string, cart: CartLine[]): CartLine | null {
  const n = normalize(name);
  return cart.find((c) => normalize(c.itemName).includes(n) || n.includes(normalize(c.itemName))) ?? null;
}

function priceForItem(item: MenuItemView) {
  if (item.variations.length > 0) {
    const cheapest = [...item.variations].sort((a, b) => a.price - b.price)[0];
    return { unitPrice: cheapest.price, variationId: cheapest.id, variationName: cheapest.name };
  }
  return { unitPrice: item.basePrice, variationId: null as string | null, variationName: null as string | null };
}

function addToCart(cart: CartLine[], item: MenuItemView, qty: number, note?: string): CartLine[] {
  const { unitPrice, variationId, variationName } = priceForItem(item);
  const idx = cart.findIndex((c) => c.itemId === item.id && c.variationId === variationId);
  const next = [...cart];
  if (idx >= 0) {
    next[idx] = { ...next[idx], qty: next[idx].qty + qty };
  } else {
    next.push({ itemId: item.id, itemName: item.name, variationId, variationName, qty, unitPrice, note: note ?? null });
  }
  return next;
}

function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, c) => sum + c.unitPrice * c.qty, 0);
}

function formatCartLine(c: CartLine): string {
  return `${c.qty}x ${c.itemName}${c.variationName ? ` (${c.variationName})` : ''} — PKR ${Math.round(c.unitPrice * c.qty)}`;
}

function buildCartSummaryText(cart: CartLine[]): string {
  if (cart.length === 0) return 'Your cart is empty. Reply "menu" to start ordering.';
  const lines = cart.map(formatCartLine).join('\n');
  return `🛒 *Your Cart*\n\n${lines}\n\nTotal: PKR ${Math.round(cartTotal(cart))}\n\nReply "menu" to add more, "done" to checkout, or "cancel" to clear your cart.`;
}

function buildMenuText(menu: MenuView, botName: string): string {
  if (menu.items.length === 0) {
    return `Sorry, our menu isn't available on WhatsApp right now. Please try again later.`;
  }
  const byCategory = new Map<string, MenuItemView[]>();
  for (const item of menu.items) {
    const list = byCategory.get(item.categoryName) ?? [];
    list.push(item);
    byCategory.set(item.categoryName, list);
  }
  const sections = [...byCategory.entries()]
    .map(([cat, items]) => `*${cat}*\n${items.map((i) => `• ${i.name} — PKR ${Math.round(i.basePrice)}`).join('\n')}`)
    .join('\n\n');
  return `Hi! I'm ${botName}. Here's our menu:\n\n${sections}\n\nReply with an item name and quantity to order (e.g. "2 chicken biryani"). Reply "cart" anytime to see your order.`;
}

function buildOrderTypeOptionsText(allowed: string[]): string {
  const opts: string[] = [];
  if (allowed.includes('TAKEAWAY')) opts.push('1️⃣ Takeaway');
  if (allowed.includes('DELIVERY')) opts.push('2️⃣ Delivery');
  return `Would you like Takeaway or Delivery?\n\n${opts.join('\n')}`;
}

function buildAddressRequestText(): string {
  return `Please send your complete delivery address including house/flat number, street, and area.\n\nExample: "House 5, Street 12, DHA Phase 6, Karachi"`;
}

function buildOrderConfirmText(cart: CartLine[], orderType: OrderType, deliveryAddress: string | null): string {
  const lines = cart.map(formatCartLine).join('\n');
  const typeText = orderType === 'DELIVERY' ? `🚚 Delivery to: ${deliveryAddress}` : '🏃 Takeaway — pay at counter';
  const paymentText = orderType === 'DELIVERY' ? 'Cash on Delivery' : 'Cash at Counter';
  return `📋 *Order Summary*\n\n${lines}\n\n${typeText}\nPayment: ${paymentText}\n\n*Total: PKR ${Math.round(cartTotal(cart))}*\n\nReply "yes" to confirm or "cancel" to cancel.`;
}

const asksTakeaway = (text: string) => /takeaway|pickup|\b1\b/i.test(text);
const asksDelivery = (text: string) => /delivery|\b2\b/i.test(text);

/**
 * Pure function driving the WhatsApp ordering journey:
 * GREETING -> BROWSING_MENU -> BUILDING_ORDER -> COLLECTING_ORDER_TYPE
 *   -> (COLLECTING_ADDRESS if DELIVERY) -> SELECTING_PAYMENT -> CONFIRMED
 *
 * No I/O — takes plain data, returns plain data. `shouldCreateOrder: true`
 * signals the caller to create the real Order; the caller is responsible
 * for building the final "order placed" message using the real order number
 * once that succeeds (this function has no order number to put in replyText
 * for that transition).
 */
export function advance(
  conversation: ConversationView,
  intent: ParsedIntent,
  config: WhatsAppConfigView,
  menu: MenuView,
): AdvanceResult {
  const { stage, cart, orderType, deliveryAddress } = conversation;
  const base: AdvanceResult = { nextStage: stage, cart, orderType, deliveryAddress, replyText: '', shouldCreateOrder: false };

  switch (stage) {
    case 'GREETING': {
      return { ...base, nextStage: 'BROWSING_MENU', replyText: buildMenuText(menu, config.botName) };
    }

    case 'BROWSING_MENU': {
      if (intent.intent === 'MENU' || intent.intent === 'GREETING') {
        return { ...base, replyText: buildMenuText(menu, config.botName) };
      }
      if (intent.intent === 'CART') {
        return { ...base, replyText: buildCartSummaryText(cart) };
      }
      if (intent.intent === 'HOURS') {
        return { ...base, replyText: `Please reply "menu" to see what we're offering right now.` };
      }
      if (intent.intent === 'ORDER' && intent.items?.length) {
        let nextCart = cart;
        const unmatched: string[] = [];
        for (const wanted of intent.items) {
          const item = matchMenuItem(wanted.name, menu);
          if (item) nextCart = addToCart(nextCart, item, Math.max(1, wanted.quantity || 1), wanted.note);
          else unmatched.push(wanted.name);
        }
        if (nextCart === cart) {
          return {
            ...base,
            replyText: `Sorry, I couldn't find "${unmatched[0]}" on our menu. Reply "menu" to see what's available.`,
          };
        }
        const note = unmatched.length ? `\n\n(Couldn't find: ${unmatched.join(', ')})` : '';
        return {
          ...base,
          nextStage: 'BUILDING_ORDER',
          cart: nextCart,
          replyText: buildCartSummaryText(nextCart) + note,
        };
      }
      return { ...base, replyText: buildMenuText(menu, config.botName) };
    }

    case 'BUILDING_ORDER': {
      if (cart.length === 0) return { ...base, nextStage: 'BROWSING_MENU', replyText: buildMenuText(menu, config.botName) };

      if (intent.intent === 'ORDER' && intent.items?.length) {
        let nextCart = cart;
        const unmatched: string[] = [];
        for (const wanted of intent.items) {
          const item = matchMenuItem(wanted.name, menu);
          if (item) nextCart = addToCart(nextCart, item, Math.max(1, wanted.quantity || 1), wanted.note);
          else unmatched.push(wanted.name);
        }
        const note = unmatched.length ? `\n\n(Couldn't find: ${unmatched.join(', ')})` : '';
        return { ...base, cart: nextCart, replyText: buildCartSummaryText(nextCart) + note };
      }

      if (intent.intent === 'REMOVE_ITEM' && intent.items?.length) {
        const target = matchCartLine(intent.items[0].name, cart);
        if (!target) return { ...base, replyText: `That's not in your cart.\n\n${buildCartSummaryText(cart)}` };
        const nextCart = cart.filter((c) => c !== target);
        if (nextCart.length === 0) return { ...base, nextStage: 'BROWSING_MENU', cart: nextCart, replyText: `Removed ${target.itemName}. Your cart is now empty. Reply "menu" to keep browsing.` };
        return { ...base, cart: nextCart, replyText: `Removed ${target.itemName}.\n\n${buildCartSummaryText(nextCart)}` };
      }

      if (intent.intent === 'QUANTITY_CHANGE' && intent.items?.length) {
        const wanted = intent.items[0];
        const target = matchCartLine(wanted.name, cart);
        if (!target || !wanted.quantity || wanted.quantity < 1) {
          return { ...base, replyText: `Couldn't update that quantity.\n\n${buildCartSummaryText(cart)}` };
        }
        const nextCart = cart.map((c) => (c === target ? { ...c, qty: wanted.quantity } : c));
        return { ...base, cart: nextCart, replyText: buildCartSummaryText(nextCart) };
      }

      if (intent.intent === 'CART') return { ...base, replyText: buildCartSummaryText(cart) };

      if (intent.intent === 'MENU') return { ...base, nextStage: 'BROWSING_MENU', replyText: buildMenuText(menu, config.botName) };

      if (intent.intent === 'CANCEL') {
        return { ...base, nextStage: 'BROWSING_MENU', cart: [], replyText: `Your cart has been cleared. Reply "menu" to start again.` };
      }

      if (intent.intent === 'CONFIRM') {
        const total = cartTotal(cart);
        if (total < config.minOrderAmount) {
          return {
            ...base,
            replyText: `Minimum order amount is PKR ${Math.round(config.minOrderAmount)}. Your current total is PKR ${Math.round(total)}. Please add PKR ${Math.round(config.minOrderAmount - total)} more to proceed.`,
          };
        }
        const allowed = config.allowedOrderTypes.length ? config.allowedOrderTypes : ['TAKEAWAY', 'DELIVERY'];
        if (allowed.length === 1) {
          const only = allowed[0] as OrderType;
          if (only === 'DELIVERY') return { ...base, nextStage: 'COLLECTING_ADDRESS', orderType: only, replyText: buildAddressRequestText() };
          return { ...base, nextStage: 'SELECTING_PAYMENT', orderType: only, replyText: buildOrderConfirmText(cart, only, null) };
        }
        return { ...base, nextStage: 'COLLECTING_ORDER_TYPE', replyText: buildOrderTypeOptionsText(allowed) };
      }

      return { ...base, replyText: buildCartSummaryText(cart) };
    }

    case 'COLLECTING_ORDER_TYPE': {
      const allowed = config.allowedOrderTypes.length ? config.allowedOrderTypes : ['TAKEAWAY', 'DELIVERY'];
      if (allowed.includes('TAKEAWAY') && asksTakeaway(intent.rawText)) {
        return { ...base, nextStage: 'SELECTING_PAYMENT', orderType: 'TAKEAWAY', replyText: buildOrderConfirmText(cart, 'TAKEAWAY', null) };
      }
      if (allowed.includes('DELIVERY') && asksDelivery(intent.rawText)) {
        return { ...base, nextStage: 'COLLECTING_ADDRESS', orderType: 'DELIVERY', replyText: buildAddressRequestText() };
      }
      return { ...base, replyText: buildOrderTypeOptionsText(allowed) };
    }

    case 'COLLECTING_ADDRESS': {
      const text = intent.rawText.trim();
      // Require multiple address components (house/street/area), not just a
      // long-ish string — "F-7 Islamabad" is 13 chars but too vague to
      // deliver to; "House 5, Street 12, F-7/1, Islamabad" has the detail.
      const looksDetailed = text.length > 20 && (text.match(/,/g) ?? []).length >= 2;
      if (looksDetailed) {
        return { ...base, nextStage: 'SELECTING_PAYMENT', deliveryAddress: text, replyText: buildOrderConfirmText(cart, 'DELIVERY', text) };
      }
      return {
        ...base,
        replyText: `Please send a more detailed address including:\n• House/flat number\n• Street name\n• Area/sector\n\nExample: "House 5, Street 12, F-7/1, Islamabad"`,
      };
    }

    case 'SELECTING_PAYMENT': {
      if (intent.intent === 'CONFIRM') {
        return { ...base, nextStage: 'CONFIRMED', shouldCreateOrder: true, replyText: '' };
      }
      if (intent.intent === 'CANCEL') {
        return { ...base, nextStage: 'ABANDONED', cart: [], replyText: `Your order has been cancelled.` };
      }
      return { ...base, replyText: buildOrderConfirmText(cart, orderType ?? 'TAKEAWAY', deliveryAddress) };
    }

    case 'CONFIRMED':
    case 'COMPLETED': {
      if (intent.intent === 'CANCEL') {
        return { ...base, replyText: `Your order is already being prepared. Please call us directly to request a cancellation.` };
      }
      if (intent.intent === 'MENU' || intent.intent === 'ORDER') {
        return { ...base, replyText: `Want to place another order? Reply "menu" to start a new one.` };
      }
      return { ...base, replyText: `Your order has been placed and is being prepared. We'll update you soon!` };
    }

    case 'ABANDONED':
    default: {
      return { ...base, nextStage: 'GREETING', replyText: buildMenuText(menu, config.botName) };
    }
  }
}

/** Built by the caller once the real Order exists (advance() has no order number to work with). */
export function buildOrderPlacedMessage(orderNumber: string, orderType: OrderType): string {
  const typeText = orderType === 'DELIVERY'
    ? 'Your order will be delivered soon. Pay cash on delivery.'
    : 'Your order will be ready for pickup soon. Pay at the counter.';
  return `✅ *Order Confirmed!*\n\nOrder #${orderNumber}\n\n${typeText}\n\nWe'll message you with updates. Thank you for ordering with us! 🙏`;
}

export { cartTotal, buildMenuText, buildCartSummaryText };
