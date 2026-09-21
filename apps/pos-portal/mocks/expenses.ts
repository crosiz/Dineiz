export type Expense = { description: string; category: string; amount: number; paidBy: string; date: string };

export const DAILY_EXPENSES: Expense[] = [
  { description: "Gas cylinder refill", category: "Utilities", amount: 3200, paidBy: "Bilal Raza", date: "Today, 9:15 AM" },
  { description: "Cleaning supplies", category: "Maintenance", amount: 1450, paidBy: "Sana K.", date: "Today, 10:40 AM" },
  { description: "Generator fuel", category: "Utilities", amount: 5000, paidBy: "Bilal Raza", date: "Yesterday" },
];

export type ExpenseCategory = { name: string; monthlyBudget: number; spentThisMonth: number };

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { name: "Utilities", monthlyBudget: 80000, spentThisMonth: 52400 },
  { name: "Maintenance", monthlyBudget: 40000, spentThisMonth: 18200 },
  { name: "Marketing", monthlyBudget: 60000, spentThisMonth: 41000 },
  { name: "Staff Welfare", monthlyBudget: 25000, spentThisMonth: 9800 },
];

export type PettyCashEntry = { type: "IN" | "OUT"; description: string; amount: number; balance: number; date: string };

export const PETTY_CASH: PettyCashEntry[] = [
  { type: "IN", description: "Float top-up", amount: 10000, balance: 12400, date: "Today, 9:00 AM" },
  { type: "OUT", description: "Gas cylinder refill", amount: 3200, balance: 2400, date: "Today, 9:15 AM" },
  { type: "OUT", description: "Cleaning supplies", amount: 1450, balance: 950, date: "Today, 10:40 AM" },
];
