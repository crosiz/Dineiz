export type StaffMember = { name: string; role: string; phone: string; status: "ACTIVE" | "ON_LEAVE"; joinedDate: string };

export const STAFF: StaffMember[] = [
  { name: "Bilal Raza", role: "Branch Manager", phone: "+92 300 1112223", status: "ACTIVE", joinedDate: "Jan 2025" },
  { name: "Sana K.", role: "Cashier", phone: "+92 301 4445556", status: "ACTIVE", joinedDate: "Mar 2025" },
  { name: "Ali Hassan", role: "Waiter", phone: "+92 302 7778889", status: "ACTIVE", joinedDate: "Jun 2025" },
  { name: "Kamran Y.", role: "Kitchen Staff", phone: "+92 303 1231234", status: "ON_LEAVE", joinedDate: "Feb 2025" },
];

export type PermissionRow = { module: string; view: boolean; create: boolean; edit: boolean; delete: boolean };

export const BRANCH_MANAGER_PERMISSIONS: PermissionRow[] = [
  { module: "Orders", view: true, create: true, edit: true, delete: false },
  { module: "Menu Management", view: true, create: true, edit: true, delete: true },
  { module: "Staff", view: true, create: true, edit: true, delete: false },
  { module: "Settings", view: true, create: false, edit: true, delete: false },
  { module: "Analytics & Reports", view: true, create: false, edit: false, delete: false },
];

export type AttendanceEntry = { staff: string; date: string; checkIn: string; checkOut: string; hours: string };

export const ATTENDANCE: AttendanceEntry[] = [
  { staff: "Ali Hassan", date: "Today", checkIn: "11:02 AM", checkOut: "—", hours: "—" },
  { staff: "Sana K.", date: "Today", checkIn: "9:58 AM", checkOut: "—", hours: "—" },
  { staff: "Kamran Y.", date: "Yesterday", checkIn: "10:05 AM", checkOut: "6:12 PM", hours: "8h 7m" },
];

export type PayrollEntry = { staff: string; role: string; baseSalary: number; bonus: number; netPay: number; month: string };

export const PAYROLL: PayrollEntry[] = [
  { staff: "Bilal Raza", role: "Branch Manager", baseSalary: 85000, bonus: 5000, netPay: 90000, month: "Aug 2026" },
  { staff: "Sana K.", role: "Cashier", baseSalary: 42000, bonus: 2000, netPay: 44000, month: "Aug 2026" },
  { staff: "Ali Hassan", role: "Waiter", baseSalary: 35000, bonus: 0, netPay: 35000, month: "Aug 2026" },
];
