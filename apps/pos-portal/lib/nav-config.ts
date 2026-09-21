import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  CirclePlus,
  ClipboardList,
  BookOpen,
  Package,
  Warehouse as WarehouseIcon,
  Grid2x2,
  Tv,
  Truck,
  Users,
  Megaphone,
  CreditCard,
  Clock,
  BarChart3,
  Plug,
  BadgeCheck,
  Settings as SettingsIcon,
} from "lucide-react";

export type NavChild = { label: string; href: string };
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Create New Order", href: "/orders/new", icon: CirclePlus },
  {
    label: "Orders",
    href: "/orders",
    icon: ClipboardList,
    children: [
      { label: "Live Orders", href: "/orders" },
      { label: "Order History", href: "/orders?tab=history" },
      { label: "Held Orders", href: "/orders/held" },
      { label: "Reversals & Refunds", href: "/orders/held?tab=reversals" },
    ],
  },
  {
    label: "Menu Management",
    href: "/menu",
    icon: BookOpen,
    children: [
      { label: "Categories", href: "/menu" },
      { label: "Items", href: "/menu?tab=items" },
      { label: "Variations & Add-ons", href: "/menu?tab=variations" },
      { label: "Deals & Combos", href: "/menu?tab=deals" },
      { label: "Availability", href: "/menu?tab=availability" },
    ],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    children: [
      { label: "Stock", href: "/inventory" },
      { label: "Ingredients", href: "/inventory?tab=ingredients" },
      { label: "Recipes", href: "/inventory?tab=recipes" },
      { label: "Purchase Orders", href: "/inventory?tab=purchase-orders" },
      { label: "Goods Receipt", href: "/inventory?tab=goods-receipt" },
      { label: "Wastage", href: "/inventory?tab=wastage" },
      { label: "Stock Check", href: "/inventory?tab=stock-check" },
      { label: "Movements", href: "/inventory?tab=movements" },
    ],
  },
  {
    label: "Warehouse",
    href: "/warehouse",
    icon: WarehouseIcon,
    children: [
      { label: "Suppliers", href: "/warehouse" },
      { label: "Balances", href: "/warehouse?tab=balances" },
      { label: "Payments", href: "/warehouse?tab=payments" },
    ],
  },
  {
    label: "Dine-In",
    href: "/tables",
    icon: Grid2x2,
    children: [
      { label: "Tables", href: "/tables" },
      { label: "Sections & Floor Plan", href: "/tables?tab=sections" },
      { label: "Sessions", href: "/tables?tab=sessions" },
      { label: "Waiters", href: "/tables?tab=waiters" },
      { label: "Reservations", href: "/tables?tab=reservations" },
    ],
  },
  { label: "Kitchen Display", href: "/kds", icon: Tv },
  {
    label: "Delivery",
    href: "/delivery",
    icon: Truck,
    children: [
      { label: "Active", href: "/delivery" },
      { label: "Riders", href: "/delivery?tab=riders" },
      { label: "Zones", href: "/delivery?tab=zones" },
      { label: "History", href: "/delivery?tab=history" },
    ],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Users,
    children: [
      { label: "All Customers", href: "/customers" },
      { label: "Segments", href: "/customers?tab=segments" },
      { label: "Loyalty", href: "/customers?tab=loyalty" },
      { label: "Feedback", href: "/customers?tab=feedback" },
    ],
  },
  {
    label: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    children: [
      { label: "Deals & Promos", href: "/marketing" },
      { label: "Coupons", href: "/marketing?tab=coupons" },
      { label: "Campaigns", href: "/marketing?tab=campaigns" },
    ],
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: CreditCard,
    children: [
      { label: "Daily Expenses", href: "/expenses" },
      { label: "Categories", href: "/expenses?tab=categories" },
      { label: "Petty Cash", href: "/expenses?tab=petty-cash" },
    ],
  },
  {
    label: "Shift Management",
    href: "/shifts",
    icon: Clock,
    children: [
      { label: "Current Shift", href: "/shifts" },
      { label: "Schedule", href: "/shifts?tab=schedule" },
      { label: "History", href: "/shifts?tab=history" },
      { label: "Cash Reconciliation", href: "/shifts?tab=reconciliation" },
    ],
  },
  {
    label: "Analytics & Reports",
    href: "/analytics",
    icon: BarChart3,
    children: [
      { label: "Sales Dashboard", href: "/analytics" },
      { label: "Reports", href: "/analytics?tab=reports" },
      { label: "Performance", href: "/analytics?tab=performance" },
    ],
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
    children: [
      { label: "Order Integration", href: "/integrations" },
      { label: "Aggregators", href: "/integrations?tab=aggregators" },
      { label: "Payments", href: "/integrations?tab=payments" },
      { label: "Webhooks", href: "/integrations?tab=webhooks" },
      { label: "Printers", href: "/integrations?tab=printers" },
    ],
  },
  {
    label: "Staff Management",
    href: "/staff",
    icon: BadgeCheck,
    children: [
      { label: "Staff", href: "/staff" },
      { label: "Roles & Permissions", href: "/staff?tab=roles" },
      { label: "Attendance", href: "/staff?tab=attendance" },
      { label: "Payroll", href: "/staff?tab=payroll" },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    children: [
      { label: "Branch", href: "/settings" },
      { label: "Receipt", href: "/settings?tab=receipt" },
      { label: "Tax", href: "/settings?tab=tax" },
      { label: "Payments", href: "/settings?tab=payments" },
      { label: "Workflow", href: "/settings?tab=workflow" },
      { label: "Devices", href: "/settings?tab=devices" },
      { label: "Notifications", href: "/settings?tab=notifications" },
      { label: "Backup", href: "/settings?tab=backup" },
    ],
  },
];

function splitHref(href: string): { path: string; tab: string | null } {
  const [path, query] = href.split("?");
  const tab = query ? new URLSearchParams(query).get("tab") : null;
  return { path, tab };
}

export function getBreadcrumb(pathname: string, tab: string | null): { section: string; page: string } {
  for (const item of NAV_ITEMS) {
    const base = splitHref(item.href).path;
    if (pathname === base || pathname.startsWith(base + "/")) {
      if (item.children) {
        const child = item.children.find((c) => {
          const cs = splitHref(c.href);
          return cs.path === pathname && cs.tab === tab;
        });
        return { section: item.label, page: child?.label ?? item.children[0].label };
      }
      return { section: item.label, page: item.label };
    }
  }
  return { section: "Dineiz", page: "" };
}

export { splitHref };
