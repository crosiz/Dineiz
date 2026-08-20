'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getPosSession } from '@/lib/pos-session';
import { useBranding } from '@/hooks/useBranding';

export function ClientAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only the bare "no session → login" check lives here, since it's the one
  // rule that should hold for the whole app regardless of route. Everything
  // else (shift requirement, role-based redirects) used to be duplicated
  // here AND in POSLayout.tsx (apps/pos/app/pos/POSLayout.tsx), running in
  // parallel on every /pos/* page. That duplicate copy never checked the
  // tenant's Settings → Point of Sale → "Require shift opening" toggle, so
  // turning that setting off had no effect in practice — this provider kept
  // force-redirecting every cashier to /pos/shift/open regardless, fighting
  // POSLayout's correct, setting-aware logic. POSLayout is the single
  // source of truth for /pos/* routing now.
  useEffect(() => {
    if (!mounted) return;

    const session = getPosSession();
    const publicRoutes = ['/login'];
    const isPublic = publicRoutes.some(route => pathname.includes(route));

    if (!session && !isPublic) {
      router.replace('/login');
    }
  }, [pathname, mounted, router]);

  // Initial paint only — applies whatever branding is already cached in
  // localStorage before POSLayout mounts (e.g. while still on /login).
  // Live updates are handled once, in POSLayout.tsx, which also syncs the
  // tax/currency fields that arrive in the same 'tenant:branding_updated'
  // payload; this used to duplicate that same socket listener with a
  // colors-only, incomplete handler, so a single branding push fired two
  // different toasts back to back.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.style.setProperty('--pos-primary', branding.primaryColor);
    root.style.setProperty('--pos-secondary', branding.secondaryColor);
    root.style.setProperty('--pos-accent', branding.accentColor);
  }, [branding, mounted]);

  // Prevent flash of content before checking session
  if (!mounted) return <>{children}</>;

  return <>{children}</>;
}

