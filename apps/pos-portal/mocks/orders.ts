import type { OrderStatus } from "@/lib/order-status";

export type OrderKind = "Dine-In" | "Takeaway" | "Delivery";
export type PaymentMethod = "Cash" | "Card" | "JazzCash" | "EasyPaisa";

export type PortalOrder = {
  id: string;
  type: OrderKind;
  table?: string;
  customer?: string;
  items: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  time: string;
};

export const LIVE_ORDERS: PortalOrder[] = [
  { id: "A109", type: "Dine-In", table: "T-09", items: 5, total: 3120, status: "PENDING", time: "1 min ago" },
  { id: "A108", type: "Dine-In", table: "T-04", items: 4, total: 2150, status: "IN_KITCHEN", time: "2 min ago" },
  { id: "A110", type: "Delivery", customer: "Sana K.", items: 3, total: 1580, status: "IN_KITCHEN", time: "4 min ago" },
  { id: "A107", type: "Takeaway", customer: "Ahmed", items: 2, total: 890, status: "READY", time: "6 min ago" },
  { id: "A111", type: "Dine-In", table: "T-11", items: 6, total: 4230, status: "READY", time: "9 min ago" },
];

export const ORDER_HISTORY: PortalOrder[] = [
  { id: "A106", type: "Delivery", customer: "Bilal R.", items: 6, total: 3420, status: "COMPLETED", paymentMethod: "Card", time: "Today, 12:41 PM" },
  { id: "A105", type: "Dine-In", table: "T-11", items: 3, total: 1680, status: "COMPLETED", paymentMethod: "Cash", time: "Today, 12:24 PM" },
  { id: "A104", type: "Dine-In", table: "T-02", items: 5, total: 2890, status: "COMPLETED", paymentMethod: "Cash", time: "Today, 12:07 PM" },
  { id: "A103", type: "Takeaway", customer: "Zara", items: 1, total: 450, status: "CANCELLED", time: "Today, 11:52 AM" },
  { id: "A102", type: "Dine-In", table: "T-06", items: 4, total: 2340, status: "COMPLETED", paymentMethod: "JazzCash", time: "Today, 11:38 AM" },
  { id: "A101", type: "Delivery", customer: "Usman T.", items: 2, total: 980, status: "COMPLETED", paymentMethod: "EasyPaisa", time: "Today, 11:15 AM" },
];

export const HELD_ORDERS: { id: string; type: OrderKind; table?: string; customer?: string; items: number; total: number; heldAt: string; heldBy: string }[] = [
  { id: "H-22", type: "Dine-In", table: "T-07", items: 3, total: 1540, heldAt: "14 min ago", heldBy: "Ali (Waiter)" },
  { id: "H-21", type: "Takeaway", customer: "Fatima", items: 2, total: 720, heldAt: "26 min ago", heldBy: "Bilal Raza" },
];

export const REVERSALS: { id: string; orderId: string; amount: number; reason: string; approvedBy: string; time: string }[] = [
  { id: "R-14", orderId: "A098", amount: 1200, reason: "Wrong item sent", approvedBy: "Bilal Raza", time: "Yesterday, 8:12 PM" },
  { id: "R-13", orderId: "A091", amount: 450, reason: "Customer changed mind", approvedBy: "Bilal Raza", time: "Yesterday, 6:40 PM" },
  { id: "R-12", orderId: "A084", amount: 2100, reason: "Duplicate order", approvedBy: "Sana K.", time: "2 days ago" },
];
