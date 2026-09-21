export const SALES_SUMMARY = {
  revenue30d: 1240000,
  orders30d: 2840,
  avgOrderValue: 437,
  topDay: "Saturday",
};

export type ReportDef = { name: string; description: string; lastRun: string };

export const REPORTS: ReportDef[] = [
  { name: "Daily Sales Summary", description: "Revenue, orders and tax breakdown by day", lastRun: "Today, 9:00 AM" },
  { name: "Item Performance", description: "Best and worst selling items by revenue and quantity", lastRun: "Yesterday" },
  { name: "Staff Performance", description: "Orders handled and average order value per staff member", lastRun: "3 days ago" },
  { name: "Tax Summary", description: "Cash vs card tax collected, ready for filing", lastRun: "Sep 1, 2026" },
];

export type TopItem = { name: string; unitsSold: number; revenue: number };

export const TOP_ITEMS: TopItem[] = [
  { name: "Chicken Karahi (Full)", unitsSold: 198, revenue: 415800 },
  { name: "Chicken Biryani", unitsSold: 412, revenue: 185400 },
  { name: "Seekh Kebab (6 pcs)", unitsSold: 356, revenue: 316840 },
  { name: "Naan", unitsSold: 1204, revenue: 72240 },
];

export type StaffPerformance = { staff: string; ordersHandled: number; avgOrderValue: number };

export const STAFF_PERFORMANCE: StaffPerformance[] = [
  { staff: "Sana K.", ordersHandled: 412, avgOrderValue: 512 },
  { staff: "Bilal Raza", ordersHandled: 289, avgOrderValue: 601 },
  { staff: "Ali Hassan", ordersHandled: 198, avgOrderValue: 445 },
];
