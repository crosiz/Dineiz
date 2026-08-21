import Dexie from 'dexie';

interface MenuCache {
  branchId: string;
  categories: any[];
  items: any[];
  cachedAt: number;
  version: number;
}

class PosDatabase extends Dexie {
  menuCache!: Dexie.Table<MenuCache, string>;

  constructor() {
    super('DineizPOS_v3');
    this.version(3).stores({
      menuCache: 'branchId, cachedAt',
    });
  }
}

const db = new PosDatabase();

const MENU_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getMenuWithCache(branchId: string, tenantId: string) {
  // Step 1: Load from IndexedDB immediately
  const cached = await db.menuCache.get(branchId);
  const cacheValid = cached && (Date.now() - cached.cachedAt) < MENU_CACHE_TTL;

  if (cacheValid) {
    // Return cached data immediately, refresh in background
    refreshMenuInBackground(branchId, tenantId);
    return { items: cached.items, categories: cached.categories, fromCache: true };
  }

  // No valid cache — must fetch
  return fetchAndCacheMenu(branchId, tenantId);
}

export async function fetchAndCacheMenu(branchId: string, tenantId: string) {
  const token = localStorage.getItem('token') || ''; 
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  
  const res = await fetch(`${apiUrl}/api/menu?branchId=${branchId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to fetch menu');
  }

  const data = await res.json();

  // Save to IndexedDB
  await db.menuCache.put({
    branchId,
    items: data.items ?? data,
    categories: data.categories ?? [],
    cachedAt: Date.now(),
    version: 1,
  });

  return { items: data.items ?? data, categories: data.categories ?? [], fromCache: false };
}

function refreshMenuInBackground(branchId: string, tenantId: string) {
  fetchAndCacheMenu(branchId, tenantId).catch(console.error);
}

export async function invalidateMenuCache(branchId: string) {
  await db.menuCache.delete(branchId);
}
