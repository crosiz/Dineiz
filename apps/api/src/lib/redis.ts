import { Redis as IORedis } from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env } from '../env';

// Keep ioredis for Socket.io adapter & BullMQ compatibility
//
// ioredis's defaults (connectTimeout: 10000ms, effectively-unbounded command
// retries via the offline queue) mean that when Redis is unreachable, a
// request-path call — e.g. order-number generation during checkout — hangs
// for a very long time before failing instead of erroring out promptly
// (confirmed directly: the old default config didn't even fail within 15s
// against an unreachable host). Bounding both here makes a misconfigured/
// down Redis fail fast and loud instead of stalling every order submission.
//
// Timeouts are sized from measured latency to this project's Upstash
// instance, not guessed: a cold connect handshake measured 945ms-4.1s
// across repeated runs (real variance, not a fluke), while commands on an
// already-open connection settled around 85ms. connectTimeout needs enough
// headroom to not misfire during normal — if variable — cold-connect
// latency; commandTimeout is a safety net for a stuck warm command, not a
// realistic budget, so it can stay tight.
export const redis = new IORedis(env.REDIS_URL, {
  keepAlive: 10000,
  connectTimeout: 8000,
  commandTimeout: 5000,
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
