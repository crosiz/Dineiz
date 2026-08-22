'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ShiftStats {
  ordersServed: number;
  totalValue: number;
  averagePerOrder: number;
}

const EMPTY_STATS: ShiftStats = { ordersServed: 0, totalValue: 0, averagePerOrder: 0 };

const cacheKey = (branchId: string, shiftId: string) => `stats-${branchId}-${shiftId}`;

async function fetchStats(branchId: string, shiftId: string): Promise<ShiftStats> {
  const res = await fetch(`${API_URL}/api/analytics/today?branchId=${branchId}&shiftId=${shiftId}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Stats fetch failed (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return {
    ordersServed: data.orders || 0,
    totalValue: data.revenue || 0,
    averagePerOrder: data.orders ? data.revenue / data.orders : 0,
  };
}

/**
 * useShiftStats — same instant-paint-then-refresh shape as useSWROrders /
 * useSWRTables, applied to Home's "Today's Performance" numbers, which
 * previously re-fetched from a blank/zero state on every mount.
 */
export function useShiftStats(branchId: string | null, shiftId: string | null) {
  const [initialData, setInitialData] = useState<ShiftStats | undefined>(undefined);
  const [initialDataUpdatedAt, setInitialDataUpdatedAt] = useState<number | undefined>(undefined);
  const [idbChecked, setIdbChecked] = useState(false);

  const keyRef = useRef<string | null>(null);
  keyRef.current = branchId && shiftId ? cacheKey(branchId, shiftId) : null;

  useEffect(() => {
    let cancelled = false;
    setIdbChecked(false);
    setInitialData(undefined);
    setInitialDataUpdatedAt(undefined);

    const key = keyRef.current;
    if (!key) {
      setIdbChecked(true);
      return;
    }

    getDB().ordersCache.get(key).then((cached) => {
      if (cancelled) return;
      if (cached && cached.data && !Array.isArray(cached.data)) {
        setInitialData(cached.data as unknown as ShiftStats);
        setInitialDataUpdatedAt(cached.cachedAt);
      }
      setIdbChecked(true);
    }).catch(() => setIdbChecked(true));

    return () => { cancelled = true; };
  }, [branchId, shiftId]);

  const queryClient = useQueryClient();
  const queryKey = ['swr-shift-stats', branchId, shiftId];

  const { data, isFetching, refetch } = useQuery<ShiftStats>({
    queryKey,
    queryFn: async () => {
      const fresh = await fetchStats(branchId!, shiftId!);
      // ordersCache's `data` field is typed as any[] for the orders use
      // case, but Dexie doesn't enforce that at runtime — reuse the same
      // table/key-value shape for this scalar payload instead of adding
      // a parallel cache table for one small object.
      getDB().ordersCache.put({ cacheKey: keyRef.current!, data: fresh as any, cachedAt: Date.now() }).catch(() => {});
      return fresh;
    },
    enabled: idbChecked && !!branchId && !!shiftId,
    initialData,
    initialDataUpdatedAt,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const stats = data ?? initialData ?? EMPTY_STATS;
  const isStale = isFetching && initialData !== undefined && data === initialData;

  return {
    stats,
    isFetching,
    isStale,
    refresh: refetch,
    /** Call after a socket event (e.g. payment:confirmed) to force a background refresh */
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
