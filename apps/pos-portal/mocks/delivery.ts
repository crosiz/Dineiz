export type ActiveDelivery = {
  orderId: string;
  customer: string;
  address: string;
  rider: string;
  status: "ASSIGNED" | "PICKED_UP" | "EN_ROUTE";
  eta: string;
};

export const ACTIVE_DELIVERIES: ActiveDelivery[] = [
  { orderId: "A110", customer: "Sana K.", address: "House 12, Street 4, DHA Phase 6", rider: "Farhan A.", status: "EN_ROUTE", eta: "8 min" },
  { orderId: "A106", customer: "Bilal R.", address: "Flat 3B, Clifton Block 2", rider: "Imran S.", status: "PICKED_UP", eta: "14 min" },
];

export type Rider = { name: string; phone: string; activeDeliveries: number; status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE"; rating: number };

export const RIDERS: Rider[] = [
  { name: "Farhan A.", phone: "+92 301 2223344", activeDeliveries: 1, status: "ON_DELIVERY", rating: 4.8 },
  { name: "Imran S.", phone: "+92 302 5556677", activeDeliveries: 1, status: "ON_DELIVERY", rating: 4.6 },
  { name: "Kashif N.", phone: "+92 303 8889900", activeDeliveries: 0, status: "AVAILABLE", rating: 4.9 },
  { name: "Waseem T.", phone: "+92 304 1112233", activeDeliveries: 0, status: "OFFLINE", rating: 4.5 },
];

export type DeliveryZone = { name: string; fee: number; avgTime: string; ordersToday: number };

export const ZONES: DeliveryZone[] = [
  { name: "Clifton", fee: 100, avgTime: "22 min", ordersToday: 14 },
  { name: "DHA Phase 5-8", fee: 150, avgTime: "28 min", ordersToday: 9 },
  { name: "Saddar", fee: 120, avgTime: "25 min", ordersToday: 5 },
];

export type DeliveryHistoryEntry = { orderId: string; customer: string; rider: string; total: number; deliveredIn: string; date: string };

export const DELIVERY_HISTORY: DeliveryHistoryEntry[] = [
  { orderId: "A099", customer: "Nadia S.", rider: "Kashif N.", total: 1450, deliveredIn: "24 min", date: "Today, 11:02 AM" },
  { orderId: "A095", customer: "Omar F.", rider: "Farhan A.", total: 890, deliveredIn: "19 min", date: "Today, 10:20 AM" },
  { orderId: "A088", customer: "Hina K.", rider: "Imran S.", total: 2340, deliveredIn: "31 min", date: "Yesterday, 8:44 PM" },
];
