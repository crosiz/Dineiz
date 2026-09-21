export type TableStatus = "FREE" | "OCCUPIED" | "RESERVED";

export type PosTable = {
  id: string;
  label: string;
  section: string;
  seats: number;
  status: TableStatus;
};

export const TABLES: PosTable[] = [
  { id: "t1", label: "T-01", section: "Main Hall", seats: 4, status: "FREE" },
  { id: "t2", label: "T-02", section: "Main Hall", seats: 4, status: "OCCUPIED" },
  { id: "t3", label: "T-03", section: "Main Hall", seats: 2, status: "FREE" },
  { id: "t4", label: "T-04", section: "Main Hall", seats: 6, status: "OCCUPIED" },
  { id: "t5", label: "T-05", section: "Main Hall", seats: 4, status: "FREE" },
  { id: "t6", label: "T-06", section: "Garden", seats: 4, status: "RESERVED" },
  { id: "t7", label: "T-07", section: "Garden", seats: 6, status: "FREE" },
  { id: "t8", label: "T-08", section: "Garden", seats: 2, status: "FREE" },
  { id: "t9", label: "T-09", section: "Family Room", seats: 8, status: "OCCUPIED" },
  { id: "t10", label: "T-10", section: "Family Room", seats: 4, status: "FREE" },
  { id: "t11", label: "T-11", section: "Family Room", seats: 4, status: "OCCUPIED" },
  { id: "t12", label: "T-12", section: "Family Room", seats: 4, status: "FREE" },
];
