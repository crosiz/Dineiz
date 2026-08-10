import { useQuery } from '@tanstack/react-query';
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
 * useMenu — fetches the menu from the API and syncs to IndexedDB.
 * Falls back to IndexedDB cache if the network request fails (offline support).
 *
 * @param tenantId - The tenant whose menu to load
 */
export function useMenu(tenantId: string | null, branchId?: string | null) {
  return useQuery<CachedMenuItem[], Error>({
    queryKey: ['menu', tenantId, branchId],
    enabled: !!tenantId,

    queryFn: async () => {
      try {
        // 1. Try the network first
        const freshItems = await fetchMenuFromAPI(tenantId!, branchId);

        // 2. Sync the fresh data into IndexedDB for future offline use
        await syncMenuToCache(tenantId!, freshItems);

        return freshItems;
      } catch (e) {
        console.error("Failed to fetch/sync menu:", e);
        // 3. Network failed — fall back to IndexedDB cache (offline mode)
        const cached = await getMenuFromCache(tenantId!);
        if (cached.length === 0) {
          throw new Error('No menu data available. Please connect to the internet.');
        }
        return cached;
      }
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
