export type Promo = { name: string; discount: string; validTill: string; active: boolean };

export const PROMOS: Promo[] = [
  { name: "Weekday Lunch 15% Off", discount: "15%", validTill: "Sep 30, 2026", active: true },
  { name: "First Order Discount", discount: "PKR 200", validTill: "Ongoing", active: true },
  { name: "Eid Special", discount: "20%", validTill: "Ended", active: false },
];

export type Coupon = { code: string; discount: string; usageLimit: number; used: number; expires: string };

export const COUPONS: Coupon[] = [
  { code: "WELCOME200", discount: "PKR 200", usageLimit: 1000, used: 412, expires: "Dec 31, 2026" },
  { code: "KABAB15", discount: "15%", usageLimit: 500, used: 288, expires: "Sep 30, 2026" },
  { code: "DELIVER50", discount: "Free delivery", usageLimit: 300, used: 301, expires: "Expired" },
];

export type Campaign = { name: string; channel: "WhatsApp" | "SMS" | "Push"; sent: number; opened: number; date: string };

export const CAMPAIGNS: Campaign[] = [
  { name: "Weekend Biryani Push", channel: "WhatsApp", sent: 3200, opened: 1840, date: "Sep 19, 2026" },
  { name: "Loyalty Points Reminder", channel: "SMS", sent: 1500, opened: 620, date: "Sep 15, 2026" },
  { name: "New Menu Launch", channel: "Push", sent: 4800, opened: 2100, date: "Sep 8, 2026" },
];
