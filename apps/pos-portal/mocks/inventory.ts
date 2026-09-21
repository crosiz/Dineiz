export type StockStatus = "OK" | "LOW" | "OUT";

export type StockItem = { name: string; unit: string; onHand: number; threshold: number; status: StockStatus };

export const STOCK_ITEMS: StockItem[] = [
  { name: "Chicken Breast", unit: "kg", onHand: 4.2, threshold: 10, status: "LOW" },
  { name: "Mutton", unit: "kg", onHand: 18, threshold: 8, status: "OK" },
  { name: "Basmati Rice", unit: "kg", onHand: 62, threshold: 20, status: "OK" },
  { name: "Mozzarella Cheese", unit: "kg", onHand: 1.8, threshold: 5, status: "LOW" },
  { name: "Cooking Oil", unit: "L", onHand: 0, threshold: 15, status: "OUT" },
  { name: "Coke Cans (250ml)", unit: "pcs", onHand: 12, threshold: 48, status: "LOW" },
  { name: "Flour", unit: "kg", onHand: 40, threshold: 15, status: "OK" },
];

export type Ingredient = { name: string; unit: string; costPerUnit: number; supplier: string };

export const INGREDIENTS: Ingredient[] = [
  { name: "Chicken Breast", unit: "kg", costPerUnit: 780, supplier: "Al-Fateh Meats" },
  { name: "Mutton", unit: "kg", costPerUnit: 2100, supplier: "Al-Fateh Meats" },
  { name: "Basmati Rice", unit: "kg", costPerUnit: 320, supplier: "Punjab Grains Co." },
  { name: "Mozzarella Cheese", unit: "kg", costPerUnit: 1450, supplier: "Dairy Fresh Ltd." },
  { name: "Cooking Oil", unit: "L", costPerUnit: 580, supplier: "Punjab Grains Co." },
];

export type RecipeLine = { ingredient: string; qty: number; unit: string };
export type Recipe = { item: string; yieldQty: string; lines: RecipeLine[] };

export const RECIPES: Recipe[] = [
  {
    item: "Chicken Karahi (Full)",
    yieldQty: "1 serving (4 pax)",
    lines: [
      { ingredient: "Chicken Breast", qty: 1.2, unit: "kg" },
      { ingredient: "Cooking Oil", qty: 0.15, unit: "L" },
    ],
  },
  {
    item: "Chicken Biryani",
    yieldQty: "1 plate",
    lines: [
      { ingredient: "Basmati Rice", qty: 0.25, unit: "kg" },
      { ingredient: "Chicken Breast", qty: 0.2, unit: "kg" },
    ],
  },
];

export type PurchaseOrder = { id: string; supplier: string; items: number; total: number; status: "DRAFT" | "SENT" | "RECEIVED"; date: string };

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: "PO-0142", supplier: "Al-Fateh Meats", items: 3, total: 84500, status: "RECEIVED", date: "Sep 18, 2026" },
  { id: "PO-0143", supplier: "Punjab Grains Co.", items: 2, total: 38000, status: "SENT", date: "Sep 20, 2026" },
  { id: "PO-0144", supplier: "Dairy Fresh Ltd.", items: 4, total: 21200, status: "DRAFT", date: "Sep 21, 2026" },
];

export type GoodsReceipt = { id: string; poRef: string; receivedBy: string; date: string; status: "COMPLETE" | "PARTIAL" };

export const GOODS_RECEIPTS: GoodsReceipt[] = [
  { id: "GRN-0098", poRef: "PO-0142", receivedBy: "Bilal Raza", date: "Sep 18, 2026", status: "COMPLETE" },
  { id: "GRN-0097", poRef: "PO-0139", receivedBy: "Sana K.", date: "Sep 15, 2026", status: "PARTIAL" },
];

export type WastageEntry = { item: string; qty: string; reason: string; cost: number; date: string };

export const WASTAGE: WastageEntry[] = [
  { item: "Chicken Breast", qty: "1.5 kg", reason: "Spoilage", cost: 1170, date: "Sep 20, 2026" },
  { item: "Naan Dough", qty: "3 kg", reason: "Over-prepped", cost: 420, date: "Sep 19, 2026" },
  { item: "Mozzarella Cheese", qty: "0.4 kg", reason: "Dropped", cost: 580, date: "Sep 18, 2026" },
];

export type StockCheck = { id: string; date: string; conductedBy: string; discrepancies: number; status: "COMPLETE" | "IN_PROGRESS" };

export const STOCK_CHECKS: StockCheck[] = [
  { id: "SC-0031", date: "Sep 15, 2026", conductedBy: "Bilal Raza", discrepancies: 2, status: "COMPLETE" },
  { id: "SC-0032", date: "Sep 21, 2026", conductedBy: "Sana K.", discrepancies: 0, status: "IN_PROGRESS" },
];

export type StockMovement = { item: string; type: "IN" | "OUT"; qty: string; reason: string; date: string };

export const MOVEMENTS: StockMovement[] = [
  { item: "Chicken Breast", type: "IN", qty: "20 kg", reason: "PO-0142 received", date: "Sep 18, 2026" },
  { item: "Basmati Rice", type: "OUT", qty: "12 kg", reason: "Kitchen consumption", date: "Sep 19, 2026" },
  { item: "Cooking Oil", type: "OUT", qty: "15 L", reason: "Kitchen consumption", date: "Sep 20, 2026" },
  { item: "Mozzarella Cheese", type: "OUT", qty: "0.4 kg", reason: "Wastage — dropped", date: "Sep 18, 2026" },
];
