import { Redis as IORedis } from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env } from '../env';

// Keep ioredis for Socket.io adapter & BullMQ compatibility
//
// ioredis's defaults (connectTimeout: 10000ms, effectively-unbounded command
// retries via the offline queue) mean that when Redis is unreachable, a
// request-path call — e.g. order-number generation during checkout — hangs
// for the full 10s+ before failing instead of erroring out immediately.
// Bounding both here makes a misconfigured/down Redis fail fast and loud
// rather than making every order submission time out silently.
export const redis = new IORedis(env.REDIS_URL, {
  keepAlive: 10000,
  connectTimeout: 3000,
  commandTimeout: 3000,
  maxRetriesPerRequest: 1,
});

// Preferred client for standard kv operations
export const upstash = new UpstashRedis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

redis.on('error', (err) => {
  console.error('Redis (ioredis) connection error:', err);
});

redis.once('connect', () => {
  console.log('Connected to Redis (ioredis)');
});
