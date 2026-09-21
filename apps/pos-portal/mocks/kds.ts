export type KdsTicketLine = { name: string; qty: number; notes?: string };

export type KdsTicket = {
  id: string;
  type: "Dine-In" | "Takeaway" | "Delivery";
  table?: string;
  customer?: string;
  lines: KdsTicketLine[];
  elapsedMin: number;
};

export const NEW_TICKETS: KdsTicket[] = [
  {
    id: "A109",
    type: "Dine-In",
    table: "T-09",
    elapsedMin: 1,
    lines: [
      { name: "Chicken Karahi (Full)", qty: 1 },
      { name: "Naan", qty: 4 },
      { name: "Fresh Lime", qty: 2 },
    ],
  },
];

export const PREPARING_TICKETS: KdsTicket[] = [
  {
    id: "A108",
    type: "Dine-In",
    table: "T-04",
    elapsedMin: 6,
    lines: [
      { name: "Seekh Kebab (6 pcs)", qty: 2, notes: "Extra spicy" },
      { name: "Garlic Naan", qty: 3 },
    ],
  },
  {
    id: "A110",
    type: "Delivery",
    customer: "Sana K.",
    elapsedMin: 4,
    lines: [
      { name: "Chicken Biryani", qty: 2 },
      { name: "Soft Drink (Can)", qty: 2 },
    ],
  },
];

export const READY_TICKETS: KdsTicket[] = [
  {
    id: "A107",
    type: "Takeaway",
    customer: "Ahmed",
    elapsedMin: 9,
    lines: [
      { name: "Chicken Tikka (Full)", qty: 1 },
      { name: "Roghni Naan", qty: 2 },
    ],
  },
];
