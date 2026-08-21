'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { DashboardProvider } from '@/contexts/dashboard-context';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
import { Header } from '@/components/layout/header/Header';
import { PlanBanner } from '@/components/layout/PlanBanner';
import { useUIStore } from '@/store/ui.store';
import { useErrorStore } from '@/store/error.store';
import { useBranches } from '@/hooks/useBranches';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useUser();
  const storeCollapsed = useUIStore(s => s.sidebarCollapsed);
  const [mounted, setMounted] = useState(false);
  
  // Pre-fetch and cache branches for the entire dashboard session
  useBranches();
  
  useEffect(() => setMounted(true), []);
  const sidebarCollapsed = mounted ? storeCollapsed : false;

  // Inject tenant theme CSS variables
  useEffect(() => {
    if (tenant?.colorPrimary) {
      document.documentElement.style.setProperty('--color-primary', tenant.colorPrimary);
    }
  }, [tenant]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addError } = useErrorStore();

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      addError('You do not have permission to access this page.');
      window.history.replaceState(null, '', '/dashboard');
    }
  }, [searchParams, addError]);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection captured gracefully:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const isRawFullscreen =
    pathname === '/dashboard/orders/live' ||
    pathname === '/dashboard/floor-plan' ||
    pathname === '/dashboard/kds' ||
    pathname === '/dashboard/menu' ||
    pathname === '/dashboard/fleet';
  const isKDS = pathname === '/dashboard/kds';
  const showHeader = !isKDS;

  return (
    <DashboardProvider>
      <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
        {!isKDS && <Sidebar />}
        {showHeader && <Header />}
        
        <main
          className={`transition-all duration-300 min-h-screen flex flex-col ${isKDS ? 'ml-0' : sidebarCollapsed ? 'ml-[68px]' : 'ml-[248px]'} ${showHeader ? 'pt-16' : ''}`}
          style={{ background: isKDS ? '#0A0A0F' : '#F8FAFC' }}
        >
          {!isKDS && showHeader && <PlanBanner />}
          
          {isRawFullscreen ? (
            children
          ) : (
            <div className="p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
              {children}
            </div>
          )}
        </main>
      </div>
    </DashboardProvider>
  );
}
