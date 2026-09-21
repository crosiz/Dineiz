import type { BadgeTone } from "@/components/ui/Badge";

export type OrderStatus = "PENDING" | "IN_KITCHEN" | "READY" | "COMPLETED" | "CANCELLED";

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: "neutral",
  IN_KITCHEN: "warning",
  READY: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_KITCHEN: "In Kitchen",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
