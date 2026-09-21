export type Supplier = { name: string; category: string; contact: string; leadTime: string };

export const SUPPLIERS: Supplier[] = [
  { name: "Al-Fateh Meats", category: "Meat & Poultry", contact: "+92 300 1234567", leadTime: "1 day" },
  { name: "Punjab Grains Co.", category: "Rice & Grains", contact: "+92 321 9876543", leadTime: "2 days" },
  { name: "Dairy Fresh Ltd.", category: "Dairy", contact: "+92 333 4567890", leadTime: "1 day" },
];

export type SupplierBalance = { supplier: string; outstanding: number; lastPayment: string; terms: string };

export const BALANCES: SupplierBalance[] = [
  { supplier: "Al-Fateh Meats", outstanding: 84500, lastPayment: "Sep 10, 2026", terms: "Net 15" },
  { supplier: "Punjab Grains Co.", outstanding: 38000, lastPayment: "Sep 5, 2026", terms: "Net 30" },
  { supplier: "Dairy Fresh Ltd.", outstanding: 0, lastPayment: "Sep 18, 2026", terms: "Net 7" },
];

export type SupplierPayment = { id: string; supplier: string; amount: number; method: "Bank Transfer" | "Cash" | "Cheque"; date: string };

export const PAYMENTS: SupplierPayment[] = [
  { id: "PAY-0211", supplier: "Dairy Fresh Ltd.", amount: 21200, method: "Bank Transfer", date: "Sep 18, 2026" },
  { id: "PAY-0210", supplier: "Al-Fateh Meats", amount: 60000, method: "Cheque", date: "Sep 10, 2026" },
  { id: "PAY-0209", supplier: "Punjab Grains Co.", amount: 25000, method: "Bank Transfer", date: "Sep 5, 2026" },
];
