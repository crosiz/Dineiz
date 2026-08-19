'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { usePlan } from '@/contexts/plan-context';
import { authClient } from '@/lib/auth-client';
import { apiGet } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/ui.store';
import { useErrorStore } from '@/store/error.store';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { LiveOrdersBadge } from './LiveOrdersBadge';
import { DineizLogo } from '@/components/ui/DineizLogo';
import { TENANT_ADMIN_NAV, BRANCH_MANAGER_NAV, NavItem } from './nav-config';
import { 
  ChevronLeft, ChevronRight, LogOut, AlertTriangle, X,
  LayoutDashboard, Zap, ClipboardList, UtensilsCrossed, 
  LayoutTemplate, Monitor, Building2, Users, Package, 
  Clock, Tag, UserCheck, Star, BarChart3, FileText, 
  TrendingUp, Globe, Truck, QrCode, Webhook, Palette, 
  CreditCard, Settings 
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={17} />,
  Zap: <Zap size={17} />,
  ClipboardList: <ClipboardList size={17} />,
  UtensilsCrossed: <UtensilsCrossed size={17} />,
  LayoutTemplate: <LayoutTemplate size={17} />,
  Monitor: <Monitor size={17} />,
  Building2: <Building2 size={17} />,
  Users: <Users size={17} />,
  Package: <Package size={17} />,
  Clock: <Clock size={17} />,
  Tag: <Tag size={17} />,
  UserCheck: <UserCheck size={17} />,
  Star: <Star size={17} />,
  BarChart3: <BarChart3 size={17} />,
  FileText: <FileText size={17} />,
  AlertTriangle: <AlertTriangle size={17} />,
  TrendingUp: <TrendingUp size={17} />,
  Globe: <Globe size={17} />,
  Truck: <Truck size={17} />,
  QrCode: <QrCode size={17} />,
  Webhook: <Webhook size={17} />,
  Palette: <Palette size={17} />,
  CreditCard: <CreditCard size={17} />,
  Settings: <Settings size={17} />,
};

// ── Brand accent colour (single source of truth for the sidebar) ─────────────
const BRAND = '#FF5722';

export function Sidebar() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  
  const { branch } = useUser();
  const branchName = branch?.name || 'My Branch';
  const branchId   = branch?.id;
  const { plan } = usePlan();
  const planLabel = plan?.displayName || plan?.name || 'Starter';

  const isBranchManager = user?.role === 'BRANCH_MANAGER';
  const isTenantAdmin   = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';

  const navConfig = isBranchManager ? BRANCH_MANAGER_NAV(branchName) : TENANT_ADMIN_NAV;

  const storeCollapsed    = useUIStore(s => s.sidebarCollapsed);
  const hasHydrated       = useUIStore(s => s.hasHydrated);
  const toggleSidebar     = useUIStore(s => s.toggleSidebar);
  const router            = useRouter();
  const queryClient       = useQueryClient();

  const handlePrefetch = (href: string) => {
    const prefetch = (queryKey: string[], url: string) => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => apiGet(url),
        staleTime: 1000 * 60 * 2,
      });
    };

    if (href === '/dashboard/menu') prefetch(['menu', branchId], `/api/menu${branchId ? `?branchId=${branchId}` : ''}`);
    if (href === '/dashboard/orders') prefetch(['orders', branchId, 1, 10, ''], `/api/orders?page=1&limit=10${branchId ? `&branchId=${branchId}` : ''}`);
    if (href === '/dashboard/staff') prefetch(['staff', branchId], `/api/staff${branchId ? `?branchId=${branchId}` : ''}`);
    if (href === '/dashboard/inventory') prefetch(['inventory', branchId], `/api/inventory${branchId ? `?branchId=${branchId}` : ''}`);
    if (href === '/dashboard/forecast') prefetch(['inventory-forecast', branchId], `/api/inventory/forecast${branchId ? `?branchId=${branchId}` : ''}`);
    if (href === '/dashboard/deals') prefetch(['deals', branchId], `/api/deals${branchId ? `?branchId=${branchId}` : ''}`);
  };

  // Render expanded until the persisted value has actually loaded, then
  // switch once — a single state transition instead of the previous
  // multi-source race between a mount flag and two independent localStorage
  // read/write paths.
  const collapsed = hasHydrated ? storeCollapsed : false;

  const { errorCount, clearErrors } = useErrorStore();
  useEffect(() => {
    if (errorCount > 0) {
      const timer = setTimeout(() => clearErrors(), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorCount, clearErrors]);

  const renderBadge = (badgeType?: string) => {
    if (badgeType === 'live_orders_count') {
      return <LiveOrdersBadge branchId={isBranchManager ? branchId : undefined} />;
    }
    return undefined;
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
      style={{
        background: 'linear-gradient(180deg, #0A0E1A 0%, #080C16 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Collapse toggle ──────────────────────────────────────────────────── */}
      <button
        onClick={toggleSidebar}
        className="absolute right-[-12px] top-[68px] z-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg cursor-pointer hover:scale-110"
        style={{
          background: '#1E2538',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <ChevronRight size={11} style={{ color: '#94A3B8' }} />
          : <ChevronLeft  size={11} style={{ color: '#94A3B8' }} />
        }
      </button>

      {/* ── Logo area ────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center overflow-hidden transition-[padding] duration-300 ease-in-out"
        style={{
          height: 68,
          paddingLeft: collapsed ? 14 : 20,
          paddingRight: collapsed ? 14 : 20,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Both variants stay mounted and crossfade via opacity — swapping
            the logo outright mid-way through the sidebar's 300ms width
            animation is what produced the visible flash/snap. */}
        <div className="relative flex items-center" style={{ height: 32 }}>
          <div
            className="transition-opacity duration-200 ease-in-out"
            style={{ opacity: collapsed ? 1 : 0, position: collapsed ? 'static' : 'absolute' }}
          >
            <DineizLogo size="md" variant="dark" showWordmark={false} />
          </div>
          <div
            className="transition-opacity duration-200 ease-in-out"
            style={{ opacity: collapsed ? 0 : 1, position: collapsed ? 'absolute' : 'static' }}
          >
            <DineizLogo size="md" variant="dark" showWordmark={true} />
          </div>
        </div>
      </div>

      {/* ── Role / context pill ──────────────────────────────────────────────── */}
      {!collapsed && (
        <div
          className="shrink-0 mx-4 mt-3 mb-1 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {isTenantAdmin ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </>
            ) : (
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-slate-500" />
            )}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-widest truncate"
            style={{ color: '#64748B', letterSpacing: '0.1em' }}
          >
            {isTenantAdmin ? planLabel : branchName}
          </span>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-2 py-2">
        {navConfig.map((section, idx) => (
          <SidebarSection key={idx} label={section.section} collapsed={collapsed}>
            {section.items.map((item: NavItem) => (
              <SidebarNavItem 
                key={item.href} 
                href={item.href}
                label={item.label}
                icon={iconMap[item.icon] || <LayoutDashboard size={17} />}
                collapsed={collapsed}
                badge={renderBadge(item.badge)}
                onHover={() => handlePrefetch(item.href)}
              />
            ))}
          </SidebarSection>
        ))}
      </nav>

      {/* ── Bottom divider + sign-out ─────────────────────────────────────────── */}
      <div className="shrink-0 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="px-2 pt-2">
          <button
            className={`flex items-center gap-3 text-[13px] font-medium w-full rounded-lg transition-all duration-200 ${
              collapsed ? 'justify-center p-3' : 'px-4 py-2.5'
            }`}
            style={{ color: '#64748B' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#F87171';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
            onClick={async () => {
              await authClient.signOut();
              router.push('/login');
            }}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* ── Global Error Toast ───────────────────────────────────────────────── */}
      {errorCount > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center backdrop-blur-md rounded-xl py-3 px-4 shadow-2xl justify-between min-w-[220px]"
          style={{
            background: 'rgba(15,10,10,0.85)',
            border: '1px solid rgba(248,113,113,0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="shrink-0 text-red-400" />
            <span className="text-sm font-semibold text-red-400">
              {errorCount} Error{errorCount !== 1 ? 's' : ''} detected
            </span>
          </div>
          <button
            onClick={clearErrors}
            className="ml-4 p-1 rounded transition-colors hover:bg-red-400/10 text-red-400"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
