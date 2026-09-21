export type FaqItem = { question: string; answer: string };

export const FAQS: FaqItem[] = [
  {
    question: "Why is the Charge button disabled?",
    answer: "Charge is disabled until the order has at least one item, and for Dine-In orders, until a table is selected.",
  },
  {
    question: "How do I change the tax rate?",
    answer: "Go to Settings → Tax. Cash and card payments use separate rates, set by your Tenant Admin.",
  },
  {
    question: "A table isn't turning green after payment",
    answer: "Table status updates the moment payment is collected. If it doesn't, check your connection — the branch may be offline.",
  },
  {
    question: "How do I hold an order and come back to it later?",
    answer: "From Create New Order, tap Hold Order. It appears under Orders → Held Orders until you resume or cancel it.",
  },
];
