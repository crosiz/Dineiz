export type Aggregator = { name: string; status: "CONNECTED" | "DISCONNECTED"; ordersToday: number; commission: string };

export const AGGREGATORS: Aggregator[] = [
  { name: "Foodpanda", status: "CONNECTED", ordersToday: 24, commission: "25%" },
  { name: "Careem Food", status: "CONNECTED", ordersToday: 11, commission: "22%" },
  { name: "Cheetay", status: "DISCONNECTED", ordersToday: 0, commission: "20%" },
];

export type PaymentGateway = { name: string; status: "ACTIVE" | "INACTIVE"; feePercent: string };

export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  { name: "JazzCash", status: "ACTIVE", feePercent: "1.9%" },
  { name: "EasyPaisa", status: "ACTIVE", feePercent: "1.9%" },
  { name: "Card (Stripe)", status: "INACTIVE", feePercent: "2.9%" },
];

export type Webhook = { event: string; url: string; status: "HEALTHY" | "FAILING"; lastTriggered: string };

export const WEBHOOKS: Webhook[] = [
  { event: "order.completed", url: "https://hooks.kababjees.pk/orders", status: "HEALTHY", lastTriggered: "2 min ago" },
  { event: "payment.received", url: "https://hooks.kababjees.pk/payments", status: "HEALTHY", lastTriggered: "6 min ago" },
  { event: "stock.low", url: "https://hooks.kababjees.pk/alerts", status: "FAILING", lastTriggered: "3 hr ago" },
];

export type Printer = { name: string; type: "Receipt" | "Kitchen"; station: string; status: "ONLINE" | "OFFLINE" };

export const PRINTERS: Printer[] = [
  { name: "Front Counter", type: "Receipt", station: "Cashier", status: "ONLINE" },
  { name: "Kitchen KOT", type: "Kitchen", station: "Main Kitchen", status: "ONLINE" },
  { name: "BBQ Station", type: "Kitchen", station: "Grill", status: "OFFLINE" },
];
