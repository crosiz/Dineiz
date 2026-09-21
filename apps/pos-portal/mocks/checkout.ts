import { TABLES } from "@/mocks/tables";
import { SESSIONS } from "@/mocks/dine-in";
import { MENU_ITEMS } from "@/mocks/menu";

export type CheckoutLine = { name: string; qty: number; price: number };
export type CheckoutOrder = { orderId: string; label: string; lines: CheckoutLine[] };

export function getOrderForTable(tableId: string): CheckoutOrder | null {
  const table = TABLES.find((t) => t.id === tableId);
  if (!table) return null;
  const session = SESSIONS.find((s) => s.table === table.label);
  if (!session) return null;
  const lines: CheckoutLine[] = [MENU_ITEMS[0]!, MENU_ITEMS[5]!, MENU_ITEMS[16]!].map((item, i) => ({
    name: item.name,
    price: item.price,
    qty: i + 1,
  }));
  return { orderId: "A108", label: `Table ${table.label}`, lines };
}
