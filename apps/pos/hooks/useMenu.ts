import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMenuFromCache, syncMenuToCache } from '../lib/offlineHelpers';
import { getToken } from '../lib/pos-session';
import type { CachedMenuItem } from '../lib/db';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── API Fetcher ─────────────────────────────────────────────────────────────

async function fetchMenuFromAPI(tenantId: string, branchId?: string | null): Promise<CachedMenuItem[]> {
  const url = new URL(`${API_URL}/api/menu`);
  if (branchId) {
    url.searchParams.append('branchId', branchId);
  }

  const res = await fetch(url.toString(), {
    credentials: 'include', // sends Better Auth session cookie
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  // The API returns categories with nested items; we flatten to CachedMenuItem[]
  const categories: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      categoryId: string;
      name: string;
      description?: string;
      basePrice: number;
      image?: string;
      isAvailable: boolean;
      sortOrder: number;
      variations: Array<{ id: string; name: string; price: number }>;
      addOns: Array<{ id: string; name: string; price: number }>;
    }>;
  }> = await res.json();

  const flat: CachedMenuItem[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      flat.push({
        ...item,
        tenantId,
        categoryName: cat.name,
        syncedAt: Date.now(),
      });
    }
  }

  return flat;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useMenu — paints instantly from the IndexedDB cache (if any), then refreshes
 * from the network in the background and patches the result in silently.
 * Falls back to a blocking network fetch only on the very first-ever load,
 * when there is nothing cached yet.
 *
 * @param tenantId - The tenant whose menu to load
 */
export function useMenu(tenantId: string | null, branchId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['menu', tenantId, branchId];

  return useQuery<CachedMenuItem[], Error>({
    queryKey,
    enabled: !!tenantId,

    queryFn: async () => {
      const cached = await getMenuFromCache(tenantId!);

      // Kick off a network refresh in the background; it patches the query
      // cache directly via setQueryData once it lands, without blocking paint.
      const refresh = fetchMenuFromAPI(tenantId!, branchId)
        .then(async (freshItems) => {
          await syncMenuToCache(tenantId!, freshItems);
          queryClient.setQueryData<CachedMenuItem[]>(queryKey, freshItems);
          return freshItems;
        })
        .catch((e) => {
          console.error('Failed to refresh menu from network:', e);
          return null;
        });

      if (cached.length > 0) {
        return cached;
      }

      // Nothing cached yet (first-ever load) — must wait for the network.
      const freshItems = await refresh;
      if (!freshItems) {
        throw new Error('No menu data available. Please connect to the internet.');
      }
      return freshItems;
    },

    // On refetch (e.g., background refresh), use cached data as placeholder
    placeholderData: (previousData) => previousData,
  });
}

// ─── Grouped by Category ──────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  name: string;
  items: CachedMenuItem[];
}

/**
 * Groups flat CachedMenuItem[] into MenuCategory[] for the grid UI.
 */
export function groupByCategory(items: CachedMenuItem[]): MenuCategory[] {
  const map = new Map<string, MenuCategory>();

  for (const item of items) {
    const key = item.categoryId;
    if (!map.has(key)) {
      map.set(key, { id: key, name: item.categoryName, items: [] });
    }
    map.get(key)!.items.push(item);
  }

  return Array.from(map.values());
}
