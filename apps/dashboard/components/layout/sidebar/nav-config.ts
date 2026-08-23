export type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export type NavSection = {
  section: string;
  items: NavItem[];
};

export const TENANT_ADMIN_NAV: NavSection[] = [
  {
    section: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Live Orders', href: '/dashboard/orders/live', icon: 'Zap', badge: 'live_orders_count' },
    ]
  },
  {
    section: 'OPERATIONS',
    items: [
      { label: 'Order History', href: '/dashboard/order-history', icon: 'ClipboardList' },
      { label: 'Menu', href: '/dashboard/menu', icon: 'UtensilsCrossed' },
      { label: 'Floor Plans', href: '/dashboard/floor-plan', icon: 'LayoutTemplate' },
      { label: 'KDS Monitor', href: '/dashboard/kds', icon: 'Monitor' },
    ]
  },
  {
    section: 'BUSINESS',
    items: [
      { label: 'Branches', href: '/dashboard/branches', icon: 'Building2' },
      { label: 'Staff & Roles', href: '/dashboard/staff', icon: 'Users' },
      { label: 'Inventory', href: '/dashboard/inventory', icon: 'Package' },
      { label: 'Shift Management', href: '/dashboard/shifts', icon: 'Clock' },
    ]
  },
  {
    section: 'GROWTH',
    items: [
      { label: 'Deals & Promos', href: '/dashboard/deals', icon: 'Tag' },
      { label: 'Customers / CRM', href: '/dashboard/customers', icon: 'UserCheck' },
      { label: 'Loyalty Program', href: '/dashboard/loyalty', icon: 'Star' },
    ]
  },
  {
    section: 'ANALYTICS',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: 'BarChart3' },
      { label: 'Reports', href: '/dashboard/reports', icon: 'FileText' },
      { label: 'Anomalies', href: '/dashboard/anomalies', icon: 'AlertTriangle' },
      { label: 'Forecast', href: '/dashboard/forecast', icon: 'TrendingUp' },
      { label: 'POS Sync Issues', href: '/dashboard/pos-sync', icon: 'WifiOff' },
    ]
  },
  {
    section: 'INTEGRATIONS',
    items: [
      { label: 'WhatsApp Bot', href: '/dashboard/whatsapp', icon: 'MessageCircle' },
      { label: 'Aggregators', href: '/dashboard/integrations/aggregators', icon: 'Globe' },
      { label: 'Fleet / Delivery', href: '/dashboard/fleet', icon: 'Truck' },
      { label: 'QR Ordering', href: '/dashboard/qr', icon: 'QrCode' },
      { label: 'Webhooks', href: '/dashboard/integrations/webhooks', icon: 'Webhook' },
    ]
  },
  {
    section: 'SETTINGS',
    items: [
      { label: 'Billing & Plan', href: '/dashboard/settings/billing', icon: 'CreditCard' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
    ]
  },
];

export const BRANCH_MANAGER_NAV = (branchName: string): NavSection[] => [
  {
    section: `MY BRANCH: ${branchName}`,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Live Orders', href: '/dashboard/orders/live', icon: 'Zap', badge: 'live_orders_count' },
    ]
  },
  {
    section: 'OPERATIONS',
    items: [
      { label: 'Order History', href: '/dashboard/order-history', icon: 'ClipboardList' },
      { label: 'Shift Management', href: '/dashboard/shifts', icon: 'Clock' },
      { label: 'KDS Screen', href: '/dashboard/kds', icon: 'Monitor' },
      { label: 'Floor Plan', href: '/dashboard/floor-plan', icon: 'LayoutTemplate' },
    ]
  },
  {
    section: 'MY BRANCH',
    items: [
      { label: 'Menu Availability', href: '/dashboard/menu/availability', icon: 'UtensilsCrossed' },
      { label: 'Inventory', href: '/dashboard/inventory', icon: 'Package' },
      { label: 'Staff on Shift', href: '/dashboard/staff/shift', icon: 'UserCheck' },
    ]
  },
  {
    section: 'REPORTS',
    items: [
      { label: "Today's Report", href: '/dashboard/reports/today', icon: 'FileText' },
      { label: 'Shift Report', href: '/dashboard/reports/shift', icon: 'ClipboardList' },
      { label: 'POS Sync Issues', href: '/dashboard/pos-sync', icon: 'WifiOff' },
    ]
  },
];


