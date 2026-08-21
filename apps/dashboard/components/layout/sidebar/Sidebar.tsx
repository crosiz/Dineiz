'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { authClient } from '@/lib/auth-client';
import { apiGet } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/ui.store';
import { useErrorStore } from '@/store/error.store';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { LiveOrdersBadge } from './LiveOrdersBadge';
import { QuickSearchModal } from './QuickSearchModal';
import { DineizLogo } from '@/components/ui/DineizLogo';
import { TENANT_ADMIN_NAV, BRANCH_MANAGER_NAV, NavItem } from './nav-config';
import { 
  PanelLeftClose, LogOut, AlertTriangle, X, Search,
  LayoutDashboard, Zap, ClipboardList, UtensilsCrossed, 
  LayoutTemplate, Monitor, Building2, Users, Package, 
  Clock, Tag, UserCheck, Star, BarChart3, FileText, 
  TrendingUp, Globe, Truck, QrCode, Webhook,
  CreditCard, Settings, MessageCircle
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Zap: <Zap size={16} />,
  ClipboardList: <ClipboardList size={16} />,
  UtensilsCrossed: <UtensilsCrossed size={16} />,
  LayoutTemplate: <LayoutTemplate size={16} />,
  Monitor: <Monitor size={16} />,
  Building2: <Building2 size={16} />,
  Users: <Users size={16} />,
  Package: <Package size={16} />,
  Clock: <Clock size={16} />,
  Tag: <Tag size={16} />,
  UserCheck: <UserCheck size={16} />,
  Star: <Star size={16} />,
  BarChart3: <BarChart3 size={16} />,
  FileText: <FileText size={16} />,
  AlertTriangle: <AlertTriangle size={16} />,
  TrendingUp: <TrendingUp size={16} />,
  Globe: <Globe size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Truck: <Truck size={16} />,
  QrCode: <QrCode size={16} />,
  Webhook: <Webhook size={16} />,
  CreditCard: <CreditCard size={16} />,
  Settings: <Settings size={16} />,
};

export function Sidebar() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  
  const { name: userName, email: userEmail, branch } = useUser();
  const branchName = branch?.name || 'Main Branch';
  const branchId   = (branch as any)?.id;

  const isBranchManager = user?.role === 'BRANCH_MANAGER';
  const navConfig = isBranchManager ? BRANCH_MANAGER_NAV(branchName) : TENANT_ADMIN_NAV;

  const storeCollapsed    = useUIStore(s => s.sidebarCollapsed);
  const hasHydrated       = useUIStore(s => s.hasHydrated);
  const toggleSidebar     = useUIStore(s => s.toggleSidebar);
  const router            = useRouter();
  const queryClient       = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Keyboard shortcuts: Ctrl+B (sidebar toggle) & Ctrl+K / Cmd+K (quick search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

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
    <>
      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-200 ease-in-out select-none bg-[#101012] border-r border-zinc-800/80 text-zinc-300 ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        {/* ── Top Header Bar (Unified Single Bar, Vercel Style) ──────────────── */}
        <div className="shrink-0 h-16 border-b border-zinc-800/80 flex items-center px-4 bg-[#101012]">
          {!collapsed ? (
            <div className="flex items-center justify-between w-full">
              <Link href="/dashboard" className="flex items-center transition-opacity hover:opacity-90">
                <DineizLogo size="md" variant="dark" showWordmark={true} />
              </Link>
              
              <button
                onClick={toggleSidebar}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <button
                onClick={toggleSidebar}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors group relative focus:outline-none"
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <DineizLogo size="sm" variant="dark" showWordmark={false} />
                
                {/* Floating Tooltip */}
                <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 transition-opacity duration-150 shadow-2xl bg-[#18181B] text-zinc-100 border border-zinc-700/80 flex items-center gap-1.5">
                  <span>Expand Sidebar</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-mono border border-zinc-700">Ctrl+B</kbd>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ── Quick Search Trigger Bar ───────────────────────────────────────── */}
        <div className="shrink-0 px-3 pt-3 pb-1">
          {!collapsed ? (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors group focus:outline-none shadow-xs"
              title="Search pages (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search size={13} className="text-zinc-500 group-hover:text-zinc-300" />
                <span className="text-[12px] font-medium text-zinc-400 group-hover:text-zinc-200">Search or jump to...</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-zinc-800/80 transition-colors group relative focus:outline-none"
              title="Search (Ctrl+K)"
            >
              <Search size={15} />
              <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 transition-opacity duration-150 shadow-2xl bg-[#18181B] text-zinc-100 border border-zinc-700/80 flex items-center gap-1.5">
                <span>Quick Search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-mono border border-zinc-700">⌘K</kbd>
              </div>
            </button>
          )}
        </div>

        {/* ── Navigation List ───────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-2.5 py-2 space-y-0.5">
          {navConfig.map((section, idx) => (
            <SidebarSection key={idx} label={section.section} collapsed={collapsed}>
              {section.items.map((item: NavItem) => (
                <SidebarNavItem 
                  key={item.href} 
                  href={item.href}
                  label={item.label}
                  icon={iconMap[item.icon] || <LayoutDashboard size={16} />}
                  collapsed={collapsed}
                  badge={renderBadge(item.badge)}
                  onHover={() => handlePrefetch(item.href)}
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        {/* ── Bottom User Profile & Sign-Out ────────────────────────────────── */}
        <div className="shrink-0 p-2 border-t border-zinc-800/80 bg-[#101012]">
          {!collapsed ? (
            <div className="p-1.5 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#FF5722] text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
                  {userName ? userName.substring(0, 2).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">{userName || 'Administrator'}</p>
                  <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5 font-mono">{userEmail || 'admin@dineiz.com'}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await authClient.signOut();
                  router.push('/login');
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                await authClient.signOut();
                router.push('/login');
              }}
              className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors group relative"
              title="Sign Out"
            >
              <div className="w-7 h-7 rounded-full bg-[#FF5722] text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
                {userName ? userName.substring(0, 2).toUpperCase() : 'A'}
              </div>
              <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 transition-opacity duration-150 shadow-2xl bg-[#18181B] text-zinc-100 border border-zinc-700/80 flex items-center gap-1.5">
                <LogOut size={13} className="text-rose-400" />
                <span>Sign Out ({userName || 'User'})</span>
              </div>
            </button>
          )}
        </div>

        {/* ── Global Error Toast ─────────────────────────────────────────────── */}
        {errorCount > 0 && (
          <div className="fixed bottom-6 right-6 z-[100] flex items-center backdrop-blur-md rounded-xl py-3 px-4 shadow-2xl justify-between min-w-[220px] bg-slate-900/90 border border-red-500/30">
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

      {/* ── Quick Search Command Modal ─────────────────────────────────────── */}
      <QuickSearchModal 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />
    </>
  );
}




