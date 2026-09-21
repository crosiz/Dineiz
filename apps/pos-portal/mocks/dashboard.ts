export const DASHBOARD_KPIS: { label: string; value: string; delta?: string; deltaTone: "success" | "danger" }[] = [
  { label: "Sales This Shift", value: "PKR 42,050", delta: "+12%", deltaTone: "success" },
  { label: "Orders Served", value: "86", delta: "+8%", deltaTone: "success" },
  { label: "Avg Order Value", value: "PKR 489", delta: "-3%", deltaTone: "danger" },
  { label: "Active Tables", value: "9 / 24", deltaTone: "success" },
];

import type { OrderStatus } from "@/lib/order-status";

export const RECENT_ORDERS: {
  id: string;
  type: "Dine-In" | "Takeaway" | "Delivery";
  table: string | null;
  items: number;
  total: number;
  status: OrderStatus;
  time: string;
}[] = [
  { id: "A108", type: "Dine-In", table: "T-04", items: 4, total: 2150, status: "IN_KITCHEN", time: "2 min ago" },
  { id: "A107", type: "Takeaway", table: null, items: 2, total: 890, status: "READY", time: "6 min ago" },
  { id: "A106", type: "Delivery", table: null, items: 6, total: 3420, status: "COMPLETED", time: "18 min ago" },
  { id: "A105", type: "Dine-In", table: "T-11", items: 3, total: 1680, status: "COMPLETED", time: "24 min ago" },
  { id: "A104", type: "Dine-In", table: "T-02", items: 5, total: 2890, status: "COMPLETED", time: "41 min ago" },
];

export const TABLE_SUMMARY: { label: string; count: number; tone: "danger" | "purple" | "success" }[] = [
  { label: "Occupied", count: 9, tone: "danger" },
  { label: "Reserved", count: 2, tone: "purple" },
  { label: "Free", count: 13, tone: "success" },
];

export const LOW_STOCK: { name: string; remaining: string; threshold: string }[] = [
  { name: "Chicken Breast", remaining: "4.2 kg", threshold: "10 kg" },
  { name: "Mozzarella Cheese", remaining: "1.8 kg", threshold: "5 kg" },
  { name: "Coke Cans (250ml)", remaining: "12 pcs", threshold: "48 pcs" },
];
