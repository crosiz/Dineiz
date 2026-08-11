import { Redis as IORedis } from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env } from '../env';

// Keep ioredis for Socket.io adapter & BullMQ compatibility
export const redis = new IORedis(env.REDIS_URL, {
  keepAlive: 10000,
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
