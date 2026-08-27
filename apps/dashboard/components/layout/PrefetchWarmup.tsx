'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/user-context';
import { useDashboardContext } from '@/contexts/dashboard-context';
import {
  PREFETCH_ROUTES,
  CRITICAL_PREFETCH_ROUTES,
  prefetchRouteData,
} from '@/lib/prefetch-map';

/**
 * Renders nothing. Once the shell has settled after login, it downloads every
 * dashboard route's JS chunk in the background (so no tab switch ever pays the
 * 300–800ms bundle cost) and warms the data for the few most-visited screens.
 * Runs during idle time so it never competes with the first paint.
 */
export function PrefetchWarmup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantId } = useUser();
  const { selectedBranchId } = useDashboardContext();

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      for (const href of PREFETCH_ROUTES) {
        try { router.prefetch(href); } catch { /* prefetch is best-effort */ }
      }
      for (const href of CRITICAL_PREFETCH_ROUTES) {
        prefetchRouteData(href, { branchId: selectedBranchId, tenantId }, queryClient);
      }
    };

    const ric =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (window as any).requestIdleCallback
        : null;
    const id = ric ? ric(run, { timeout: 2500 }) : setTimeout(run, 1200);

    return () => {
      cancelled = true;
      if (ric && 'cancelIdleCallback' in window) (window as any).cancelIdleCallback(id);
      else clearTimeout(id as ReturnType<typeof setTimeout>);
    };
    // Re-warm the critical data when the active branch changes.
  }, [router, queryClient, tenantId, selectedBranchId]);

  return null;
}
