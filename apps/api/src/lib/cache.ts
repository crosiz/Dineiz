import { upstash as redis } from './redis';

// Generic cache wrapper — wrap any async function
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null) return hit;
  } catch (err) {
    // Cache miss or Redis error — fall through to DB
    console.error(`[Cache Error] Failed to get key ${key}:`, err);
  }

  // Cache miss — fetch from DB
  const data = await fetchFn();

  // Store in cache (don't await — fire and forget for speed)
  if (data !== null && data !== undefined) {
    redis.set(key, data, { ex: ttlSeconds }).catch(err => {
      console.error(`[Cache Error] Failed to set key ${key}:`, err);
    });
  }

  return data;
}

// Invalidate a cache key (call this when data changes)
export async function invalidate(key: string): Promise<void> {
  await redis.del(key).catch(err => console.error(`[Cache Error] Failed to delete key ${key}:`, err));
}

// Invalidate all keys matching a pattern
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    let cursor = 0;
    const keys: string[] = [];
    do {
      // Upstash scan returns [cursor, [keys]]
      const result = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error(`[Cache Error] Failed to invalidate pattern ${pattern}:`, err);
  }
}

// Cache TTL constants — change here, applies everywhere
export const TTL = {
  MENU: 300,           // 5 minutes — invalidated when menu published
  BRANDING: 600,       // 10 minutes — invalidated when settings saved
  STAFF_LIST: 300,     // 5 minutes — invalidated when staff added/changed
  BRANCHES: 600,       // 10 minutes — rarely changes
  ANALYTICS: 300,      // 5 minutes — live enough for dashboard
  ELIGIBLE_DEALS: 60,  // 1 minute — needs to be fairly fresh
  SHIFT_STATS: 30,     // 30 seconds — the POS home stats card
};
