export const HOMEPAGE_FAQS = [
  {
    question: "What makes Dineiz the best POS system for restaurants, cafes, and food businesses?",
    answer: "Dineiz is engineered specifically for hospitality environments where internet connectivity and power reliability can fluctuate. Unlike cloud-only POS systems that freeze when the connection drops, Dineiz is 100% offline-first: it punches orders, prints thermal receipts, and syncs seamlessly once reconnected. It integrates tablet billing, an Android mobile app (Dineiz Go), WhatsApp AI conversational ordering, kitchen displays (KDS), and raw recipe inventory into one easy system.",
  },
  {
    question: "Can Dineiz take orders and print receipts without an internet connection?",
    answer: "Yes, absolutely. Dineiz utilizes a local-first outbox synchronization engine. Every menu item punched, bill printed, or table updated is stored instantly on your device's local database. When the internet connection returns, all offline transactions automatically sync with the cloud with zero duplicate orders and zero data loss.",
  },
  {
    question: "How does Dineiz WhatsApp AI ordering work?",
    answer: "Dineiz connects with the official WhatsApp Cloud API. Customers can send an order message in Roman Urdu, English, or mixed slang (e.g. '2 biryani aur 1 raita bhej dein'). The AI parses the dish names, quantities, and delivery address to draft an order. Your staff reviews and confirms it on the POS with one tap, sending it directly to the kitchen display screen without manual re-typing.",
  },
  {
    question: "What hardware, tablets, and thermal receipt printers does Dineiz support?",
    answer: "Dineiz is completely hardware agnostic. It runs on Android tablets (Android 8+), Apple iPads (iOS 14+), Android smartphones, and Windows touch POS machines. For printing, it natively supports standard ESC/POS 58mm and 80mm thermal receipt printers via Bluetooth, USB, LAN/Ethernet, or Wi-Fi (including Epson, Sunmi, Xprinter, Star Micronics, and Bixolon), as well as electronic cash drawers.",
  },
  {
    question: "Is Dineiz free for small food carts, dhabas, and home kitchens?",
    answer: "Yes! Dineiz offers the 'Go Free' plan, which is 100% free forever for small vendors, street carts, and roadside dhabas. It supports up to 100 orders per month on the Dineiz Go Android app with full offline billing. Paid tiers start at just PKR 999/month (~$3.50 USD) with a 14-day free trial on all paid plans.",
  },
  {
    question: "How does Dineiz handle multi-branch restaurant chains and franchise reporting?",
    answer: "With Dineiz Console, multi-branch operators can manage all outlets from a single dashboard. You can update menu prices across all branches simultaneously, compare location revenue in real-time, enforce staff role permissions, and view consolidated sales and inventory telemetry from anywhere on your phone.",
  },
  {
    question: "Does Dineiz support FBR POS integration and provincial sales tax (SRB, PRA, KPRA)?",
    answer: "Yes. Dineiz includes configurable tax modules for Pakistan's Federal Board of Revenue (FBR) POS invoicing mandates with QR codes, as well as provincial authorities including PRA, SRB, KPRA, and BRA. It also supports differentiated tax rates for cash versus credit/debit card payments.",
  },
  {
    question: "How quickly can our restaurant get started with Dineiz?",
    answer: "Most restaurants go live within 14 minutes. You can sign up, enter or import your menu categories, connect your thermal printer, and start punching tickets immediately. Our team also provides free guided onboarding and menu setup assistance via WhatsApp (+92-314-1986044).",
  },
];

export const POS_FAQS = [
  {
    question: "Does Dineiz POS require specialized proprietary touch hardware?",
    answer: "No. Dineiz POS is completely hardware agnostic. It runs smoothly on standard Android tablets (Android 8+), Apple iPads (iOS 14+), and Windows touch POS machines.",
  },
  {
    question: "What happens if our restaurant's Wi-Fi or broadband disconnects during dinner rush?",
    answer: "Dineiz POS continues operating without any disruption. Orders are punched, table states are managed, and thermal receipts are printed locally. All transactions sync automatically once reconnected.",
  },
  {
    question: "Can we connect multiple POS tablets to the same kitchen display (KDS)?",
    answer: "Yes. Multiple cashier terminals and waiter handheld tablets can operate simultaneously, routing orders directly to designated kitchen preparation screens in real time.",
  },
  {
    question: "Which thermal receipt printers work with Dineiz POS?",
    answer: "Standard 80mm and 58mm ESC/POS thermal printers connected via USB, Bluetooth, LAN/Ethernet, or Wi-Fi (including Epson, Sunmi, Xprinter, Star Micronics, and Bixolon).",
  },
  {
    question: "Can cashiers split bills by seat or individual items?",
    answer: "Yes. Dineiz POS allows flexible bill splitting by headcount or custom item allocation in seconds, saving valuable time during peak checkout hours.",
  },
];
