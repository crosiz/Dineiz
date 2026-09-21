export const SECTIONS: { id: string; name: string; tables: number; occupied: number }[] = [
  { id: "main", name: "Main Hall", tables: 5, occupied: 2 },
  { id: "garden", name: "Garden", tables: 3, occupied: 1 },
  { id: "family", name: "Family Room", tables: 4, occupied: 2 },
];

export type DineInSession = {
  table: string;
  guests: number;
  openedAt: string;
  waiter: string;
  runningTotal: number;
};

export const SESSIONS: DineInSession[] = [
  { table: "T-02", guests: 3, openedAt: "12:10 PM", waiter: "Ali Hassan", runningTotal: 2890 },
  { table: "T-04", guests: 5, openedAt: "12:38 PM", waiter: "Sara Iqbal", runningTotal: 2150 },
  { table: "T-09", guests: 6, openedAt: "12:52 PM", waiter: "Ali Hassan", runningTotal: 3120 },
  { table: "T-11", guests: 4, openedAt: "1:05 PM", waiter: "Zain Abbas", runningTotal: 4230 },
];

export type Waiter = { name: string; sections: string[]; activeTables: number; status: "On Floor" | "On Break" };

export const WAITERS: Waiter[] = [
  { name: "Ali Hassan", sections: ["Main Hall"], activeTables: 2, status: "On Floor" },
  { name: "Sara Iqbal", sections: ["Main Hall", "Garden"], activeTables: 1, status: "On Floor" },
  { name: "Zain Abbas", sections: ["Family Room"], activeTables: 1, status: "On Floor" },
  { name: "Hina Kamal", sections: ["Garden"], activeTables: 0, status: "On Break" },
];

export type Reservation = {
  name: string;
  partySize: number;
  time: string;
  table: string;
  status: "Confirmed" | "Pending" | "Seated";
};

export const RESERVATIONS: Reservation[] = [
  { name: "Farooq Family", partySize: 6, time: "7:30 PM", table: "T-09", status: "Confirmed" },
  { name: "Ayesha Malik", partySize: 2, time: "8:00 PM", table: "T-03", status: "Confirmed" },
  { name: "Khan Party", partySize: 8, time: "8:30 PM", table: "T-06", status: "Pending" },
  { name: "Nadia S.", partySize: 4, time: "6:45 PM", table: "T-07", status: "Seated" },
];
