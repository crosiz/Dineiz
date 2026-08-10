'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getPosSession, getPosShift } from '@/lib/pos-session';
import { useBranding } from '@/hooks/useBranding';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';

export function ClientAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const session = getPosSession();
    const shift = getPosShift();
    const publicRoutes = ['/login'];

    // Convert potential pathname that lacks / to a standard format if needed
    // Assuming base path is just login
    const isPublic = publicRoutes.some(route => pathname.includes(route));

    if (!session && !isPublic) {
      router.replace('/login');
      return;
    }

    const role = session?.role?.toUpperCase() || '';

    // If no shift is open, force them to open one (except Kitchen Staff and Waiters)
    if (session && !shift && !['KITCHEN_STAFF', 'WAITER'].includes(role) && !pathname.includes('/pos/shift/open')) {
      router.replace('/pos/shift/open');
      return;
    }

    if (role === 'KITCHEN_STAFF' && !pathname.includes('/pos/kds')) {
      router.replace('/pos/kds');
    }
  }, [pathname, mounted, router]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.style.setProperty('--pos-primary', branding.primaryColor);
    root.style.setProperty('--pos-secondary', branding.secondaryColor);
    root.style.setProperty('--pos-accent', branding.accentColor);

    if (!socket) return;

    const handleBranding = (newBranding: any) => {
      localStorage.setItem('pos_branding', JSON.stringify(newBranding));
      root.style.setProperty('--pos-primary', newBranding.primaryColor);
      root.style.setProperty('--pos-secondary', newBranding.secondaryColor);
      root.style.setProperty('--pos-accent', newBranding.accentColor);
      toast.success('Branding updated by manager', { duration: 3000 });
    };

    socket.on('tenant:branding_updated', handleBranding);

    return () => {
      socket.off('tenant:branding_updated', handleBranding);
    };
  }, [branding, mounted, socket]);

  // Prevent flash of content before checking session
  if (!mounted) return <>{children}</>;

  return <>{children}</>;
}

