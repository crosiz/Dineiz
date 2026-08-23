import { edb } from './event-log';

// Cart draft persistence — survives a break lock, a browser crash, or a
// tab close while an order is still in the builder and hasn't been sent to
// the kitchen yet (nothing durable exists for it until then: cart state
// lives only in the in-memory Zustand cart store). One draft slot per
// terminal is enough — a cashier only ever builds one order at a time on a
// given terminal.

const CART_DRAFT_KEY = 'cart_draft';

export interface CartDraft {
  cart: any[];
  orderType: string | null;
  selectedTableId: string | null;
  selectedTableLabel: string | null;
  customerId: string | null;
  customerName: string | null;
  notes: string | null;
  reason: 'break' | 'autosave';
}

export async function saveCartDraft(draft: CartDraft): Promise<void> {
  if (!draft.cart?.length) return;
  await edb.drafts.put({ key: CART_DRAFT_KEY, value: draft, savedAt: new Date().toISOString() });
}

export async function loadCartDraft(): Promise<(CartDraft & { savedAt: string }) | null> {
  const row = await edb.drafts.get(CART_DRAFT_KEY);
  if (!row) return null;
  return { ...(row.value as CartDraft), savedAt: row.savedAt };
}

export async function clearCartDraft(): Promise<void> {
  await edb.drafts.delete(CART_DRAFT_KEY);
}
