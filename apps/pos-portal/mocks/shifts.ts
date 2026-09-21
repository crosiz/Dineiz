export const CURRENT_SHIFT = {
  openedBy: "Bilal Raza",
  openedAt: "12:52 PM",
  openingFloat: 5000,
  ordersSoFar: 86,
  salesSoFar: 42050,
  staffOnShift: 6,
};

export type ScheduleEntry = { staff: string; role: string; start: string; end: string; day: string };

export const SCHEDULE: ScheduleEntry[] = [
  { staff: "Ali Hassan", role: "Waiter", start: "11:00 AM", end: "7:00 PM", day: "Today" },
  { staff: "Sara Iqbal", role: "Waiter", start: "1:00 PM", end: "9:00 PM", day: "Today" },
  { staff: "Kamran Y.", role: "Kitchen Staff", start: "10:00 AM", end: "6:00 PM", day: "Today" },
  { staff: "Bilal Raza", role: "Branch Manager", start: "12:00 PM", end: "10:00 PM", day: "Today" },
];

export type ShiftHistoryEntry = { id: string; staff: string; date: string; duration: string; sales: number; variance: number };

export const SHIFT_HISTORY: ShiftHistoryEntry[] = [
  { id: "SH-0412", staff: "Sana K.", date: "Yesterday", duration: "9h 10m", sales: 68400, variance: 0 },
  { id: "SH-0411", staff: "Bilal Raza", date: "2 days ago", duration: "10h 5m", sales: 74200, variance: -150 },
  { id: "SH-0410", staff: "Sana K.", date: "3 days ago", duration: "8h 40m", sales: 59800, variance: 50 },
];

export type Reconciliation = { shiftId: string; expected: number; counted: number; variance: number; status: "MATCHED" | "SHORT" | "OVER" };

export const RECONCILIATIONS: Reconciliation[] = [
  { shiftId: "SH-0412", expected: 68400, counted: 68400, variance: 0, status: "MATCHED" },
  { shiftId: "SH-0411", expected: 74200, counted: 74050, variance: -150, status: "SHORT" },
  { shiftId: "SH-0410", expected: 59800, counted: 59850, variance: 50, status: "OVER" },
];
