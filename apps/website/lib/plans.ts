export const PLANS = [
  {
    id: 'GO_FREE',
    name: 'Go Free',
    tagline: 'Perfect for single-counter dhabas',
    monthlyPrice: 0,
    annualPrice: 0,
    cta: 'Download Free App',
    ctaLink: 'https://play.google.com/store/apps/details?id=pk.dineiz.go',
    color: '#6B7280',
    features: {
      included: [
        'Mobile billing app',
        'Up to 30 orders/day',
        '1 staff account',
        'Basic daily reports',
        'Bluetooth print support',
        'Works offline',
      ],
      excluded: [
        'Tablet POS',
        'Admin dashboard',
        'Analytics',
        'Inventory tracking',
        'Multi-branch',
      ],
      limits: { branches: 1, staff: 1, dailyOrders: 30, reportHistory: 1 }
    }
  },
  {
    id: 'GO_PRO',
    name: 'Go Pro',
    tagline: 'For growing small restaurants',
    monthlyPrice: 999,
    annualPrice: 9990,
    cta: 'Start Free Trial',
    ctaLink: 'https://wa.me/923141986044?text=Hi%2C%20I%20am%20interested%20in%20starting%20a%20free%20trial%20of%20Dineiz%20POS.',
    color: '#FF6B35',
    features: {
      included: [
        'Everything in Go Free',
        'Unlimited daily orders',
        '30-day report history',
        'Customer loyalty program',
        'Deals and promotions',
        'GST tax configuration',
        '2 staff accounts',
        'WhatsApp support',
      ],
      excluded: [],
      limits: { branches: 1, staff: 2, dailyOrders: -1, reportHistory: 30 }
    }
  },
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'For restaurants with a counter',
    monthlyPrice: 2999,
    annualPrice: 29990,
    isPopular: true,
    cta: 'Start Free Trial',
    ctaLink: 'https://wa.me/923141986044?text=Hi%2C%20I%20am%20interested%20in%20starting%20a%20free%20trial%20of%20Dineiz%20POS.',
    color: '#FF6B35',
    features: {
      included: [
        'Everything in Go Pro',
        'Tablet POS terminal',
        'Web admin dashboard',
        'Kitchen display (KDS)',
        'Table and floor management',
        'Basic inventory tracking',
        '5 staff accounts',
        '90-day report history',
        'Shift management',
        'Email support 48h response',
      ],
      excluded: [],
      limits: { branches: 1, staff: 5, dailyOrders: -1, reportHistory: 90 }
    }
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For multi-branch restaurants',
    monthlyPrice: 5999,
    annualPrice: 59990,
    cta: 'Start Free Trial',
    ctaLink: 'https://wa.me/923141986044?text=Hi%2C%20I%20am%20interested%20in%20starting%20a%20free%20trial%20of%20Dineiz%20POS.',
    color: '#FF6B35',
    features: {
      included: [
        'Everything in Starter',
        'Up to 3 branches',
        '15 staff accounts',
        'Full inventory with recipes',
        'Customer CRM',
        'Advanced analytics',
        'Aggregator integration (Foodpanda)',
        'QR table ordering',
        'Anomaly and fraud detection',
        'Webhooks and integrations',
        'WhatsApp support 24h response',
      ],
      excluded: [],
      limits: { branches: 3, staff: 15, dailyOrders: -1, reportHistory: 365 }
    }
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'For restaurant chains',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'Custom',
    cta: 'Contact Sales',
    ctaLink: 'https://dineiz.com/contact?reason=enterprise',
    color: '#0A0A0A',
    features: {
      included: [
        'Everything in Pro',
        'Unlimited branches',
        'Unlimited staff accounts',
        'Dedicated account manager',
        'Custom onboarding (in person)',
        'SLA: 4-hour response',
        'API access',
        'White label options',
        'Custom integrations',
        'Monthly strategy calls',
      ],
      excluded: [],
      limits: { branches: -1, staff: -1, dailyOrders: -1, reportHistory: -1 }
    }
  }
];

export const PRICING_FAQS = [
  {
    question: "Can I change my plan anytime?",
    answer: "Yes, upgrade takes effect immediately. Downgrade takes effect at your next billing date."
  },
  {
    question: "How do I pay for the subscription?",
    answer: "JazzCash, EasyPaisa, debit/credit card, or annual bank transfer. Monthly reminders sent via WhatsApp and email."
  },
  {
    question: "What happens when my free trial ends?",
    answer: "You continue with the free features of that plan. To restore premium features, subscribe from the dashboard."
  },
  {
    question: "Is there a setup fee?",
    answer: "Never. No setup fees, no onboarding fees, no hidden charges."
  },
  {
    question: "Do you offer refunds?",
    answer: "Yes. 7-day refund for monthly plans. 30-day prorated refund for annual plans."
  },
  {
    question: "Can multiple cashiers use Dineiz POS simultaneously?",
    answer: "Yes, any number of tablets can be connected simultaneously. Each cashier logs in with their own PIN."
  },
  {
    question: "Does Dineiz work without internet?",
    answer: "Yes. The POS works offline and syncs automatically when the connection returns."
  },
  {
    question: "What support do I get?",
    answer: "All plans get community support. Go Pro and above get WhatsApp support. Enterprise gets a dedicated account manager."
  }
];
