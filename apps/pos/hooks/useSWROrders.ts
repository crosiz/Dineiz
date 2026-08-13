'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── IDB helpers ─────────────────────────────────────────────────────────────

async function readCache(cacheKey: string): Promise<{ data: any[]; cachedAt: number } | null> {
  try {
    const db = getDB();
    const record = await db.ordersCache.get(cacheKey);
    if (!record) return null;
    return { data: record.data, cachedAt: record.cachedAt };
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string, data: any[]): Promise<void> {
  try {
    const db = getDB();
    await db.ordersCache.put({ cacheKey, data, cachedAt: Date.now() });
  } catch {
    // Non-fatal — cache write failure should never break the UI
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSWROrdersOptions {
  branchId: string | null;
  dataMode: 'live' | 'history';
  myOrdersOnly: boolean;
  cashierId?: string | null;
  waiterId?: string | null;
  sortOrder: 'oldest' | 'newest' | 'table';
  historySearch: string;
  /** Poll interval in ms while live mode is active (default: 15 000) */
  refetchIntervalMs?: number;
}

interface UseSWROrdersResult {
  orders: any[];
  /** True while a background network request is in-flight */
  isFetching: boolean;
  /**
   * True when we are rendering data sourced from the IDB cache and the
   * background network fetch has not yet returned with fresh data.
   */
  isStale: boolean;
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSWROrders({
  branchId,
  dataMode,
  myOrdersOnly,
  cashierId,
  waiterId,
  sortOrder,
  historySearch,
  refetchIntervalMs = 15_000,
}: UseSWROrdersOptions): UseSWROrdersResult {
  // Composite key — one cache slot per (mode × branch)
  const cacheKey = `${dataMode}-${branchId ?? 'none'}`;

  // ── 1. Read IDB cache before query fires ──────────────────────────────────
  const [initialData, setInitialData] = useState<any[] | undefined>(undefined);
  const [initialDataUpdatedAt, setInitialDataUpdatedAt] = useState<number | undefined>(undefined);
  const [idbChecked, setIdbChecked] = useState(false);

  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  useEffect(() => {
    let cancelled = false;
    // Reset when cache key changes (mode/branch switch)
    setIdbChecked(false);
    setInitialData(undefined);
    setInitialDataUpdatedAt(undefined);

    readCache(cacheKeyRef.current).then((cached) => {
      if (cancelled) return;
      if (cached && cached.data.length > 0) {
        setInitialData(cached.data);
        setInitialDataUpdatedAt(cached.cachedAt);
      }
      setIdbChecked(true);
    });

    return () => { cancelled = true; };
  // Re-run only when the composite cache key changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // ── 2. Network fetch ──────────────────────────────────────────────────────

  const fetchOrders = async (): Promise<any[]> => {
    if (!branchId) return [];

    if (dataMode === 'live') {
      const params = new URLSearchParams({ branchId });
      const res = await fetch(`${API_URL}/api/orders/live?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Live orders fetch failed (${res.status})`);
      const json = await res.json();
      let orders: any[] = Array.isArray(json.orders) ? json.orders : Array.isArray(json) ? json : [];

      if (myOrdersOnly && cashierId) {
        orders = orders.filter(
          (o: any) => o.cashierId === cashierId || o.shift?.userId === cashierId || o.assignedWaiterId === cashierId,
        );
      }

      if (waiterId && waiterId !== 'ALL') {
        orders = orders.filter((o: any) => o.assignedWaiterId === waiterId);
      }

      if (sortOrder === 'oldest') {
        orders.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (sortOrder === 'newest') {
        orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sortOrder === 'table') {
        orders.sort((a: any, b: any) => (a.tableLabel || '').localeCompare(b.tableLabel || ''));
      }

      return orders;
    }

    // history mode
    const params = new URLSearchParams({
      branchId,
      page: '1',
      limit: '50',
      ...(historySearch ? { search: historySearch } : {}),
      ...(myOrdersOnly && cashierId ? { cashierId } : {}),
      ...(waiterId && waiterId !== 'ALL' ? { waiterId } : {}),
    });
    const res = await fetch(`${API_URL}/api/orders/history?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`History orders fetch failed (${res.status})`);
    const json = await res.json();
    return json.orders || [];
  };

  // ── 3. TanStack Query with IDB snapshot as initialData ───────────────────
  //
  // We enable the query only after `idbChecked` so:
  //   • If IDB had data  → component renders instantly, network runs in bg
  //   • If IDB was empty → query fires immediately (first-ever visit)
  //
  // `initialDataUpdatedAt` tells React Query how fresh the seed data is.
  // If it is older than `staleTime`, RQ refetches in background right away —
  // exactly the stale-while-revalidate pattern.

  const queryKey =
    dataMode === 'live'
      ? ['swr-active-orders', branchId, myOrdersOnly, sortOrder, waiterId]
      : ['swr-history-orders', branchId, myOrdersOnly, historySearch, waiterId];

  const { data: networkData, isFetching, refetch } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const fresh = await fetchOrders();
      // Fire-and-forget write-back to IDB
      writeCache(cacheKey, fresh);
      return fresh;
    },
    enabled: idbChecked && !!branchId,
    initialData,
    initialDataUpdatedAt,
    // 30 s freshness window — if IDB data is < 30 s old, no immediate refetch
    staleTime: 30_000,
    // Keep query alive in memory for 5 min after unmount
    gcTime: 5 * 60_000,
    // Poll every 15 s in live mode only
    refetchInterval: dataMode === 'live' ? refetchIntervalMs : false,
  });

  // ── 4. Refetch when the tab becomes visible again ─────────────────────────
  //
  // The global QueryClient disables refetchOnWindowFocus (to avoid mid-
  // transaction flashes elsewhere in the POS), and refetchInterval pauses
  // entirely while the tab is hidden — so switching away and back otherwise
  // leaves this view showing whatever was last fetched before the tab was
  // backgrounded until the next 15s poll tick catches up. For live orders,
  // a stale board is worse than a brief refetch, so resync immediately here.
  useEffect(() => {
    if (dataMode !== 'live') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dataMode, refetch]);

  // ── 5. Derive isStale ─────────────────────────────────────────────────────
  const orders = networkData ?? initialData ?? [];
  // We're "stale" when showing IDB seed data and the background fetch is still running
  const isStale = isFetching && initialData !== undefined && networkData === initialData;

  return { orders, isFetching, isStale, refresh: refetch };
}
