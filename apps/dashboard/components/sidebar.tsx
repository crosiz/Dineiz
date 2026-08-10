"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart2, 
  ClipboardList, 
  Utensils, 
  Package, 
  Settings, 
  Users,
  LayoutGrid,
  Tag,
  User,
  BarChart3,
  TrendingUp,
  Star,
  MonitorPlay,
  Clock,
  Layers,
  Map,
  History,
  AlertTriangle,
  LineChart,
  Lock
} from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { usePlanFeature } from "@/hooks/usePlanFeature";
import { DineizLogo } from "@/components/ui/DineizLogo";

// @ts-ignore - bypassing UI util path resolution for simplicity
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const adminNavSections = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: BarChart2, featureKey: "adminDashboard" },
      { name: "Live Orders", href: "/dashboard/orders/live", icon: ClipboardList, featureKey: "adminDashboard" },
      { name: "Order History", href: "/dashboard/order-history", icon: History, featureKey: "adminDashboard" },
    ]
  },

  {
    title: "MANAGEMENT",
    items: [
      { name: "Menu Management", href: "/dashboard/menu", icon: Utensils, featureKey: "adminDashboard" },
      { name: "Branches", href: "/dashboard/branches", icon: LayoutGrid, featureKey: "adminDashboard" },
      { name: "Floor Plan", href: "/dashboard/floor-plan", icon: Map, featureKey: "floorPlan" },
      { name: "Staff & Roles", href: "/dashboard/staff", icon: Users, featureKey: "staffRoles" },
      { name: "Shift Management", href: "/dashboard/shifts", icon: Clock, featureKey: "shiftManagement" },
      { name: "Inventory", href: "/dashboard/inventory", icon: Package, featureKey: "inventory" },
    ]
  },
  {
    title: "GROWTH",
    items: [
      { name: "Deals & Promos", href: "/dashboard/deals", icon: Tag, featureKey: "dealsPromos" },
      { name: "Customers / CRM", href: "/dashboard/customers", icon: User, featureKey: "crmCustomers" },
      { name: "Loyalty Program", href: "/dashboard/loyalty", icon: Star, featureKey: "loyaltyProgram" },
    ]
  },
  {
    title: "ANALYTICS",
    items: [
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, featureKey: "analytics" },
      { name: "Reports", href: "/dashboard/reports", icon: TrendingUp, featureKey: "reports" },
      { name: "Anomalies", href: "/dashboard/anomalies", icon: AlertTriangle, featureKey: "anomalies" },
      { name: "Forecast", href: "/dashboard/forecast", icon: LineChart, featureKey: "forecast" },
    ]
  },
  {
    title: "INTEGRATIONS",
    items: [
      { name: "Integrations", href: "/dashboard/integrations", icon: Layers, featureKey: "aggregators" },
      { name: "Aggregators", href: "/dashboard/integrations/aggregators", icon: Layers, featureKey: "aggregators" },
      { name: "Webhooks", href: "/dashboard/integrations/webhooks", icon: Layers, featureKey: "webhooks" },
    ]
  },
  {
    title: "SETTINGS",
    items: [
      { name: "Billing & Plan", href: "/dashboard/settings/billing", icon: Settings, featureKey: "adminDashboard" },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, featureKey: "adminDashboard" },
    ]
  }
];

const managerNavSections = [
  {
    title: "OPERATIONS",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: BarChart2, featureKey: "adminDashboard" },
      { name: "Live Orders", href: "/dashboard/orders/live", icon: ClipboardList, featureKey: "adminDashboard" },
      { name: "Order History", href: "/dashboard/order-history", icon: History, featureKey: "adminDashboard" },
      { name: "Shift Management", href: "/dashboard/shifts", icon: Clock, featureKey: "shiftManagement" },
      { name: "KDS Screen", href: "/dashboard/kds", icon: MonitorPlay, featureKey: "kds" },
    ]
  },
  {
    title: "BRANCH",
    items: [
      { name: "Menu Availability", href: "/dashboard/menu/availability", icon: Utensils, featureKey: "adminDashboard" },
      { name: "Floor Plan", href: "/dashboard/floor-plan", icon: Map, featureKey: "floorPlan" },
      { name: "Inventory", href: "/dashboard/inventory", icon: Package, featureKey: "inventory" },
      { name: "Staff on Shift", href: "/dashboard/staff/shift", icon: Users, featureKey: "shiftManagement" },
    ]
  },
  {
    title: "REPORTS",
    items: [
      { name: "Reports", href: "/dashboard/reports", icon: TrendingUp, featureKey: "reports" },
    ]
  }
];

export function Sidebar({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  
  const pathname = usePathname();
  const { role, name, email, branch } = useUser();
  const { hasFeature, loading: planLoading } = usePlanFeature();

  const isTenantAdmin = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const sections = isTenantAdmin ? adminNavSections : managerNavSections;

  return (
    <>
      <aside 
        className={cn(
          "bg-surface-base border-r border-border transition-all duration-300 ease-in-out flex flex-col h-full",
          isExpanded ? "w-64" : "w-[72px]",
          className
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="flex h-[72px] items-center justify-center border-b border-border shrink-0 px-4">
          <DineizLogo size="md" variant="dark" showWordmark={isExpanded} />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 flex flex-col px-3 custom-scrollbar">
          {!isTenantAdmin && isExpanded && (
            <div className="mb-4 px-2 text-xs font-bold text-brand-primary uppercase tracking-wider">
              MY BRANCH: {branch?.name || 'Assigned Branch'}
            </div>
          )}

          {sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              {isExpanded && (
                <h3 className="px-3 mb-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const allHrefs = sections.flatMap(s => s.items.map(i => i.href));
                  const isExactMatch = pathname === item.href;
                  const isParentMatch =
                    item.href !== '/dashboard' &&
                    pathname?.startsWith(`${item.href}/`) &&
                    !allHrefs.some(h => h !== item.href && h.length > item.href.length && pathname?.startsWith(h));
                  const isActive = isExactMatch || isParentMatch;
                  
                  // Feature locking logic
                  const locked = !planLoading && item.featureKey ? !hasFeature(item.featureKey) : false;

                  return locked ? (
                    <button
                      key={item.name}
                      onClick={() => {
                        setUpgradeFeature(item.name);
                        setShowUpgradeModal(true);
                      }}
                      className={cn(
                        "flex items-center rounded-lg transition-colors h-[40px] shrink-0 opacity-40 hover:opacity-60 cursor-pointer w-full",
                        isExpanded ? "px-3" : "justify-center"
                      )}
                      title={!isExpanded ? `${item.name} (Locked)` : undefined}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 text-text-secondary" />
                      {isExpanded && (
                        <div className="ml-3 flex items-center justify-between flex-1">
                          <span className="text-sm whitespace-nowrap text-text-secondary">{item.name}</span>
                          <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                        </div>
                      )}
                    </button>
                  ) : (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center rounded-lg transition-colors h-[40px] shrink-0",
                        isActive 
                          ? "bg-brand-primary/10 text-brand-primary font-semibold" 
                          : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary font-medium",
                        isExpanded ? "px-3" : "justify-center"
                      )}
                      title={!isExpanded ? item.name : undefined}
                    >
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-brand-primary" : "")} />
                      {isExpanded && (
                        <span className="ml-3 text-sm whitespace-nowrap">{item.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border flex justify-center shrink-0">
          {isExpanded ? (
            <div className="flex items-center w-full px-2 py-2 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-brand-secondary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand-primary">{name.substring(0, 2).toUpperCase()}</span>
              </div>
              <div className="ml-3 flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-text-primary truncate">{name}</span>
                <span className="text-xs text-text-secondary truncate">{email}</span>
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-brand-secondary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-brand-primary">{name.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-base border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-brand-primary" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Upgrade Required</h3>
            <p className="text-sm text-text-secondary mb-6">
              The <strong className="text-text-primary">{upgradeFeature}</strong> feature is not available on your current plan. Upgrade to unlock this and other premium features.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Maybe Later
              </button>
              <Link 
                href="/dashboard/settings/billing"
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 bg-brand-primary text-black font-bold text-sm rounded-xl hover:bg-brand-secondary transition-colors"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
