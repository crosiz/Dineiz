'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useUIStore } from '@/store/ui.store';
import { BranchSelector } from './BranchSelector';
import { NotificationBell } from './NotificationBell';
import { Sun, CloudSun, Sunset, Moon } from 'lucide-react';

const BRAND = '#FF5722';

function computeGreeting(name: string) {
  const hour = new Date().getHours();
  const firstName = name.split(' ')[0];
  if (hour >= 5  && hour < 12) return `Good morning, ${firstName}`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${firstName}`;
  if (hour >= 17 && hour < 21) return `Good evening, ${firstName}`;
  return `Good night, ${firstName}`;
}

function TimeIcon() {
  const hour = new Date().getHours();
  const cls = "text-slate-400";
  if (hour >= 5  && hour < 12) return <Sun size={17} className={cls} />;
  if (hour >= 12 && hour < 17) return <CloudSun size={17} className={cls} />;
  if (hour >= 17 && hour < 21) return <Sunset size={17} className={cls} />;
  return <Moon size={17} className={cls} />;
}

const routeConfig: Record<string, { hidesBranchSelector?: boolean }> = {
  '/dashboard/branches': { hidesBranchSelector: true },
};

export function Header() {
  const { name }       = useUser();
  const { userRole }   = useDashboardContext();
  const storeCollapsed = useUIStore(s => s.sidebarCollapsed);
  const [mounted, setMounted]   = useState(false);
  const [greeting, setGreeting] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    setGreeting(computeGreeting(name));
  }, [name]);

  const sidebarCollapsed = mounted ? storeCollapsed : false;
  const sidebarW         = sidebarCollapsed ? 68 : 240;
  const hidesBranchSelector = routeConfig[pathname]?.hidesBranchSelector ?? false;

  return (
    <header
      className="fixed top-0 right-0 flex items-center justify-between px-8 z-40 transition-all duration-300"
      style={{
        left: sidebarW,
        height: 68,
        background: 'rgba(248,250,252,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* LEFT: greeting */}
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 leading-none select-none">
        <TimeIcon />
        <span>{greeting}</span>
      </h2>

      {/* RIGHT: controls */}
      <div className="flex items-center gap-3">
        {/* Branch selector */}
        {!hidesBranchSelector && (userRole === 'TENANT_ADMIN' || userRole === 'BRANCH_MANAGER') && (
          <BranchSelector />
        )}
        {hidesBranchSelector && (
          <div className="flex items-center px-3 h-9 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-500 font-medium select-none gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            All Branches
          </div>
        )}

        <NotificationBell />

        {/* Help */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          title="Help"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* User avatar */}
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shadow-sm transition-all hover:ring-2 hover:ring-offset-1"
          style={{ background: BRAND, ringColor: BRAND }}
          title={name}
        >
          {name.substring(0, 2).toUpperCase()}
        </button>
      </div>
    </header>
  );
}
