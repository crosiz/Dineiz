'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useUIStore } from '@/store/ui.store';
import { authClient } from '@/lib/auth-client';
import { API_URL } from '@/lib/api';
import { toast } from 'sonner';
import { BranchSelector } from './BranchSelector';
import { NotificationBell } from './NotificationBell';
import { Camera, LogOut, ChevronRight, HelpCircle, User, PanelLeft } from 'lucide-react';

const BRAND = '#FF5722';

const ROUTE_LABELS: Record<string, { section: string; title: string }> = {
  '/dashboard': { section: 'Overview', title: 'Dashboard' },
  '/dashboard/orders/live': { section: 'Operations', title: 'Live Orders' },
  '/dashboard/order-history': { section: 'Operations', title: 'Order History' },
  '/dashboard/menu': { section: 'Operations', title: 'Menu Management' },
  '/dashboard/floor-plan': { section: 'Operations', title: 'Floor Plans' },
  '/dashboard/kds': { section: 'Operations', title: 'KDS Monitor' },
  '/dashboard/branches': { section: 'Management', title: 'Branches' },
  '/dashboard/staff': { section: 'Management', title: 'Staff & Roles' },
  '/dashboard/inventory': { section: 'Operations', title: 'Inventory' },
  '/dashboard/shifts': { section: 'Operations', title: 'Shift Management' },
  '/dashboard/deals': { section: 'Growth', title: 'Deals & Promotions' },
  '/dashboard/customers': { section: 'Growth', title: 'Customers & CRM' },
  '/dashboard/loyalty': { section: 'Growth', title: 'Loyalty Program' },
  '/dashboard/analytics': { section: 'Analytics', title: 'Business Analytics' },
  '/dashboard/reports': { section: 'Analytics', title: 'Reports' },
  '/dashboard/anomalies': { section: 'Analytics', title: 'Anomalies' },
  '/dashboard/forecast': { section: 'Analytics', title: 'Forecast & Planning' },
  '/dashboard/whatsapp': { section: 'Integrations', title: 'WhatsApp Bot' },
  '/dashboard/integrations/aggregators': { section: 'Integrations', title: 'Aggregators' },
  '/dashboard/fleet': { section: 'Integrations', title: 'Fleet & Delivery' },
  '/dashboard/qr': { section: 'Integrations', title: 'QR Ordering' },
  '/dashboard/integrations/webhooks': { section: 'Integrations', title: 'Webhooks' },
  '/dashboard/settings/billing': { section: 'Settings', title: 'Billing & Plan' },
  '/dashboard/settings': { section: 'Settings', title: 'General Settings' },
};

/** Initials-or-photo avatar, shared between the header button and its menu. */
function Avatar({ name, image, size }: { name: string; image: string | null; size: number }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-[#FF5722]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name ? name.substring(0, 2).toUpperCase() : 'U'}
    </div>
  );
}

const routeConfig: Record<string, { hidesBranchSelector?: boolean }> = {
  '/dashboard/branches': { hidesBranchSelector: true },
};

export function Header() {
  const { name, email, image, refreshUser } = useUser();
  const { userRole }   = useDashboardContext();
  const storeCollapsed = useUIStore(s => s.sidebarCollapsed);
  const toggleSidebar  = useUIStore(s => s.toggleSidebar);
  const [mounted, setMounted]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const sidebarCollapsed = mounted ? storeCollapsed : false;
  const sidebarW         = sidebarCollapsed ? 68 : 248;
  const hidesBranchSelector = routeConfig[pathname]?.hidesBranchSelector ?? false;

  const currentRouteMeta = ROUTE_LABELS[pathname] || { section: 'Admin', title: 'Console' };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/settings/user/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error();
      await refreshUser();
      toast.success('Profile picture updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  return (
    <header
      className="fixed top-0 right-0 flex items-center justify-between px-6 z-40 transition-all duration-300 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs"
      style={{
        left: sidebarW,
        height: 64,
      }}
    >
      {/* LEFT: Contextual Breadcrumb & Sidebar Toggle */}
      <div className="flex items-center gap-2 text-sm select-none">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none -ml-1 mr-1"
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <span className="font-medium text-slate-400">Dineiz</span>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="font-medium text-slate-500">{currentRouteMeta.section}</span>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="font-semibold text-slate-900">{currentRouteMeta.title}</span>
      </div>

      {/* RIGHT: controls */}
      <div className="flex items-center gap-3">
        {/* Branch selector */}
        {!hidesBranchSelector && (userRole === 'TENANT_ADMIN' || userRole === 'BRANCH_MANAGER') && (
          <BranchSelector />
        )}
        {hidesBranchSelector && (
          <div className="flex items-center px-3 h-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium select-none gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            All Branches
          </div>
        )}

        <NotificationBell />

        {/* Help */}
        <button
          onClick={() => toast.info('Help center is available in Settings & Support')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Help & Support"
        >
          <HelpCircle size={17} />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200" />

        {/* User avatar + menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="rounded-full transition-all ring-1 ring-slate-200 hover:ring-2 hover:ring-[#FF5722]/50 p-0.5 focus:outline-none"
            title={name || 'User Profile'}
          >
            <Avatar name={name || 'User'} image={image} size={32} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                <Avatar name={name || 'User'} image={image} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{email || 'admin@dineiz.com'}</p>
                </div>
              </div>

              <button
                onClick={() => { setMenuOpen(false); router.push('/dashboard/settings'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <User size={15} className="text-slate-400" />
                Account Settings
              </button>

              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <Camera size={15} className="text-slate-400" />
                {uploading ? 'Uploading…' : 'Change photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

