'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDB } from '@/lib/db';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SWRTable {
  id: string;
  label: string;
  capacity: number;
  status: string; // 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'READY' | 'DIRTY' | ...
  floorNumber: number;
  occupiedSince?: string | number | Date | null;
}

// Same cache key ClientTableMap.tsx already writes to (its own inline
// stale-while-revalidate for GET /api/floor-plan/:branchId) — sharing the
// key means whichever screen visits first primes the cache for the other,
// instead of each screen keeping its own copy of the same floor plan.
const cacheKey = (branchId: string) => `floor-plan-${branchId}`;

async function fetchTables(branchId: string): Promise<SWRTable[]> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/floor-plan/${branchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Floor plan fetch failed (${res.status})`);
  const plan = await res.json();
  const raw = Array.isArray(plan) ? plan : plan.tables || [];
  return raw.map((t: any) => ({
    id: t.id,
    label: t.label,
    capacity: t.capacity || 4,
    status: (t.status || 'FREE').toUpperCase(),
    floorNumber: t.floorNumber || t.floor || 1,
    occupiedSince: t.occupiedSince || t.since,
  }));
}

/**
 * useSWRTables — paints instantly from the IndexedDB cache (shared with
 * ClientTableMap's floor plan), refreshes from the network in the
 * background, same stale-while-revalidate shape as useSWROrders.
 */
export function useSWRTables(branchId: string | null, refetchIntervalMs = 30_000) {
  const [initialData, setInitialData] = useState<SWRTable[] | undefined>(undefined);
  const [initialDataUpdatedAt, setInitialDataUpdatedAt] = useState<number | undefined>(undefined);
  const [idbChecked, setIdbChecked] = useState(false);

  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;

  useEffect(() => {
    let cancelled = false;
    setIdbChecked(false);
    setInitialData(undefined);
    setInitialDataUpdatedAt(undefined);

    if (!branchId) {
      setIdbChecked(true);
      return;
    }

    getDB().ordersCache.get(cacheKey(branchId)).then((cached) => {
      if (cancelled) return;
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        setInitialData(cached.data);
        setInitialDataUpdatedAt(cached.cachedAt);
      }
      setIdbChecked(true);
    }).catch(() => setIdbChecked(true));

    return () => { cancelled = true; };
  }, [branchId]);

  const { data: networkData, isFetching, refetch } = useQuery<SWRTable[]>({
    queryKey: ['swr-tables', branchId],
    queryFn: async () => {
      const fresh = await fetchTables(branchId!);
      getDB().ordersCache.put({ cacheKey: cacheKey(branchId!), data: fresh, cachedAt: Date.now() }).catch(() => {});
      return fresh;
    },
    enabled: idbChecked && !!branchId,
    initialData,
    initialDataUpdatedAt,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: refetchIntervalMs,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const tables = networkData ?? initialData ?? [];
  const isStale = isFetching && initialData !== undefined && networkData === initialData;

  return { tables, isFetching, isStale, refresh: refetch };
}
