import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

/**
 * Single source of truth for what to warm before the user reaches a route.
 * Used by two callers:
 *  - Sidebar hover (after a 100ms dwell) — prefetch this route's JS + primary data.
 *  - DashboardLayout post-login warm-up — router.prefetch every route, plus the
 *    data for the few highest-traffic ones.
 *
 * `null` means "route JS only" — the screen has no stable client cache key yet
 * (still fetches in useEffect, or its key depends on filter state). Those still
 * get router.prefetch, just no data prefetch.
 */
export interface PrefetchCtx {
  branchId: string | null;
  tenantId: string;
}

export interface PrefetchEntry {
  queryKey: unknown[];
  url: string;
}

const withBranch = (path: string, branchId: string | null, join = '?') =>
  branchId ? `${path}${join}branchId=${branchId}` : path;

export const PREFETCH_MAP: Record<string, (ctx: PrefetchCtx) => PrefetchEntry | null> = {
  '/dashboard': ({ branchId }) => ({
    queryKey: ['dashboardSummary', branchId],
    url: withBranch('/api/analytics/dashboard-summary?period=today', branchId, '&'),
  }),
  '/dashboard/shifts': ({ branchId }) => ({
    queryKey: ['shift-stats-active', branchId ?? undefined],
    url: withBranch('/api/shifts/stats/active', branchId),
  }),
  '/dashboard/menu': ({ branchId }) => ({
    queryKey: ['menu', branchId],
    url: withBranch('/api/menu', branchId),
  }),
  '/dashboard/menu/availability': ({ branchId }) => ({
    queryKey: ['menu', branchId],
    url: withBranch('/api/menu', branchId),
  }),
  '/dashboard/branches': () => ({ queryKey: ['branches'], url: '/api/branches' }),
  '/dashboard/staff': ({ branchId }) => ({
    queryKey: ['staff', 'summary', branchId, undefined],
    url: withBranch('/api/staff/summary', branchId),
  }),
  '/dashboard/staff/shift': ({ branchId }) => ({
    queryKey: ['staff', 'summary', branchId, undefined],
    url: withBranch('/api/staff/summary', branchId),
  }),
  '/dashboard/inventory': ({ branchId }) => ({
    queryKey: ['inventory', 'summary', branchId],
    url: withBranch('/api/inventory/summary', branchId),
  }),

  // Route JS only for now (converted to useQuery in Phase 2 → add data keys then)
  '/dashboard/order-history': () => null,
  '/dashboard/orders/live': () => null,
  '/dashboard/floor-plan': () => null,
  '/dashboard/kds': () => null,
  '/dashboard/deals': () => null,
  '/dashboard/customers': () => null,
  '/dashboard/loyalty': () => null,
  '/dashboard/analytics': () => null,
  '/dashboard/reports': () => null,
  '/dashboard/reports/today': () => null,
  '/dashboard/reports/shift': () => null,
  '/dashboard/anomalies': () => null,
  '/dashboard/forecast': () => null,
  '/dashboard/pos-sync': () => null,
  '/dashboard/whatsapp': () => null,
  '/dashboard/integrations/aggregators': () => null,
  '/dashboard/integrations/webhooks': () => null,
  '/dashboard/fleet': () => null,
  '/dashboard/qr': () => null,
  '/dashboard/settings': () => null,
  '/dashboard/settings/billing': () => null,
};

export const PREFETCH_ROUTES = Object.keys(PREFETCH_MAP);

/** Warm the data for these right after login (alongside router.prefetch of all). */
export const CRITICAL_PREFETCH_ROUTES = [
  '/dashboard',
  '/dashboard/shifts',
  '/dashboard/order-history',
];

/** Prefetch one route's primary data into the shared query cache. */
export function prefetchRouteData(
  href: string,
  ctx: PrefetchCtx,
  queryClient: QueryClient,
) {
  const entry = PREFETCH_MAP[href]?.(ctx);
  if (!entry) return;
  queryClient.prefetchQuery({
    queryKey: entry.queryKey,
    queryFn: () => apiFetch(entry.url),
    staleTime: 1000 * 60 * 2,
  });
}
