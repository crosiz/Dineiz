export type Customer = { name: string; phone: string; orders: number; totalSpent: number; lastOrder: string; tier: "Bronze" | "Silver" | "Gold" };

export const CUSTOMERS: Customer[] = [
  { name: "Bilal Raza", phone: "+92 300 1112223", orders: 42, totalSpent: 128400, lastOrder: "Today, 12:41 PM", tier: "Gold" },
  { name: "Sana K.", phone: "+92 301 4445556", orders: 18, totalSpent: 52600, lastOrder: "Today, 12:15 PM", tier: "Silver" },
  { name: "Ahmed T.", phone: "+92 302 7778889", orders: 6, totalSpent: 9800, lastOrder: "3 days ago", tier: "Bronze" },
  { name: "Zara M.", phone: "+92 303 1231234", orders: 25, totalSpent: 71200, lastOrder: "Yesterday", tier: "Silver" },
];

export type Segment = { name: string; description: string; customerCount: number };

export const SEGMENTS: Segment[] = [
  { name: "VIP", description: "Top 10% spenders, 20+ orders", customerCount: 34 },
  { name: "At Risk", description: "No order in 30+ days", customerCount: 61 },
  { name: "New", description: "First order in last 14 days", customerCount: 22 },
];

export type LoyaltyTier = { name: string; minPoints: number; perks: string; members: number };

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { name: "Bronze", minPoints: 0, perks: "Birthday discount", members: 890 },
  { name: "Silver", minPoints: 5000, perks: "5% off + birthday discount", members: 240 },
  { name: "Gold", minPoints: 15000, perks: "10% off + free delivery + birthday discount", members: 58 },
];

export type Feedback = { customer: string; rating: number; comment: string; orderId: string; date: string };

export const FEEDBACK: Feedback[] = [
  { customer: "Bilal Raza", rating: 5, comment: "Best karahi in Clifton, every time.", orderId: "A104", date: "Today, 12:30 PM" },
  { customer: "Ahmed T.", rating: 3, comment: "Order took longer than the app said.", orderId: "A098", date: "Yesterday" },
  { customer: "Zara M.", rating: 4, comment: "Great food, packaging could be better.", orderId: "A091", date: "2 days ago" },
];
