import Anthropic from '@anthropic-ai/sdk';

export type WhatsAppIntentType =
  | 'GREETING'
  | 'MENU'
  | 'ORDER'
  | 'CART'
  | 'REMOVE_ITEM'
  | 'QUANTITY_CHANGE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'HOURS'
  | 'STATUS_QUERY'
  | 'UNCLEAR';

export interface ParsedIntentItem {
  name: string;
  quantity: number;
  note?: string;
}

export interface ParsedIntent {
  intent: WhatsAppIntentType;
  items?: ParsedIntentItem[];
  confidence: number;
  language: 'en' | 'ur' | 'mixed';
  rawText: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const VALID_INTENTS: WhatsAppIntentType[] = [
  'GREETING', 'MENU', 'ORDER', 'CART', 'REMOVE_ITEM', 'QUANTITY_CHANGE',
  'CONFIRM', 'CANCEL', 'HOURS', 'STATUS_QUERY', 'UNCLEAR',
];

/**
 * Parses a customer's WhatsApp message into a structured intent, using Claude
 * when available and falling back to keyword matching when it isn't (no API
 * key configured, or the API call itself fails).
 */
export async function parseIntent(
  message: string,
  menuContext: string,
  historyContext: string,
  currentCart: Array<{ itemName: string; qty: number }>,
): Promise<ParsedIntent> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackParse(message);

  const systemPrompt = `You are an AI that understands customer messages for a restaurant ordering system in Pakistan.

Parse the customer's message and return ONLY valid JSON identifying their intent and any items they want to order. Customers may write in English, Urdu, or a mix of both.

Common Urdu ordering phrases:
- "ek biryani dena" = give me one biryani
- "do naan chahiye" = I want two naan
- "menu dikhao" = show me the menu
- "cancel karo" = cancel
- "theek hai / ok / haan" = yes / confirm
- "nahi" = no

RESTAURANT MENU:
${menuContext}

CURRENT CART:
${currentCart.length > 0 ? currentCart.map((i) => `${i.qty}x ${i.itemName}`).join(', ') : 'Empty'}

RECENT CONVERSATION:
${historyContext || '(none)'}

Return ONLY JSON in this exact shape, nothing else:
{
  "intent": "ORDER",
  "items": [{ "name": "Chicken Biryani", "quantity": 2, "note": "extra spicy" }],
  "confidence": 0.95,
  "language": "mixed"
}

Intent values: GREETING, MENU, ORDER, CART, REMOVE_ITEM, QUANTITY_CHANGE, CONFIRM, CANCEL, HOURS, STATUS_QUERY, UNCLEAR.
Use ORDER for any message naming item(s) to add, REMOVE_ITEM when the customer wants an item taken out of the cart (populate items[0].name with the item to remove), QUANTITY_CHANGE when they're adjusting a quantity of something already in the cart (populate items[0].name and items[0].quantity with the NEW quantity), CONFIRM for affirmative replies (yes/ok/haan/theek hai/proceed/confirm/done), CANCEL for negative/cancel replies (no/nahi/cancel), UNCLEAR when you cannot determine intent.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '';
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || !VALID_INTENTS.includes(parsed.intent)) {
      return fallbackParse(message);
    }

    return {
      intent: parsed.intent,
      items: Array.isArray(parsed.items) ? parsed.items : undefined,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      language: ['en', 'ur', 'mixed'].includes(parsed.language) ? parsed.language : 'en',
      rawText: message,
    };
  } catch {
    return fallbackParse(message);
  }
}

const GREETING_WORDS = ['hi', 'hello', 'salam', 'assalam', 'helo', 'hey'];
const MENU_WORDS = ['menu', 'memu', 'meny', 'food', 'khana'];
const CANCEL_WORDS = ['cancel', 'nahi', 'no', 'band karo'];
const CONFIRM_WORDS = ['yes', 'ok', 'okay', 'haan', 'confirm', 'theek', 'done', 'proceed', 'sahi'];
const CART_WORDS = ['cart', 'basket', 'total kitna', 'total'];
const HOURS_WORDS = ['hours', 'timing', 'open', 'kab khulte'];
const REMOVE_WORDS = ['remove', 'nikal', 'hatao', 'nahi chahiye'];

/**
 * Dependency-free keyword matcher used when Claude is unavailable or errors.
 * Deliberately simple — it only needs to keep the conversation moving, not
 * be as accurate as the AI path.
 */
export function fallbackParse(message: string): ParsedIntent {
  const lower = message.toLowerCase().trim();
  const language: ParsedIntent['language'] = /[a-z]/i.test(lower) ? 'en' : 'mixed';

  if (REMOVE_WORDS.some((w) => lower.includes(w))) {
    return { intent: 'REMOVE_ITEM', confidence: 0.6, language: 'mixed', rawText: message };
  }
  if (GREETING_WORDS.some((w) => lower === w || lower.startsWith(w + ' '))) {
    return { intent: 'GREETING', confidence: 0.9, language, rawText: message };
  }
  if (MENU_WORDS.some((w) => lower.includes(w))) {
    return { intent: 'MENU', confidence: 0.85, language, rawText: message };
  }
  if (HOURS_WORDS.some((w) => lower.includes(w))) {
    return { intent: 'HOURS', confidence: 0.8, language, rawText: message };
  }
  if (CART_WORDS.some((w) => lower.includes(w))) {
    return { intent: 'CART', confidence: 0.8, language, rawText: message };
  }
  if (CANCEL_WORDS.some((w) => lower === w || lower.includes(w))) {
    return { intent: 'CANCEL', confidence: 0.75, language: 'mixed', rawText: message };
  }
  if (CONFIRM_WORDS.some((w) => lower === w || lower.includes(w))) {
    return { intent: 'CONFIRM', confidence: 0.75, language: 'mixed', rawText: message };
  }

  // Try to read "<qty> <item name>" style phrases (e.g. "2 chicken biryani",
  // "ek biryani dena") as an order — a lone quantity word/digit plus the rest
  // of the message as the item name candidate.
  const qtyMatch = lower.match(/^(\d+|ek|do|teen|char)\s+(.+)/);
  if (qtyMatch) {
    const wordToNum: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4 };
    const quantity = wordToNum[qtyMatch[1]] ?? parseInt(qtyMatch[1], 10) ?? 1;
    const name = qtyMatch[2].replace(/dena|chahiye|please|dedo/gi, '').trim();
    if (name) {
      return { intent: 'ORDER', items: [{ name, quantity }], confidence: 0.5, language: 'mixed', rawText: message };
    }
  }

  if (lower.length > 2) {
    return { intent: 'ORDER', items: [{ name: lower, quantity: 1 }], confidence: 0.35, language, rawText: message };
  }

  return { intent: 'UNCLEAR', confidence: 0.3, language, rawText: message };
}
