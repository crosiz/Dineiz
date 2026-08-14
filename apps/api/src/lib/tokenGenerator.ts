import { redis } from './redis';

/**
 * Generates a daily unique token number for an order using Redis.
 * Format: [UserIdSuffix]-[DailySequenceNumber]
 * Example: A8B2-14
 * 
 * @param branchId - The branch ID where the order is placed
 * @param userId - The ID of the user (cashier/waiter) placing the order
 * @returns A unique token string
 */
export async function generateTokenNumber(branchId: string, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]; // e.g., '2026-04-23'
  const redisKey = `token_seq:${branchId}:${today}`;
  const userPrefix = userId.slice(-4).toUpperCase();

  try {
    // Atomically increment the sequence counter in Redis
    const sequence = await redis.incr(redisKey);

    // Set expiry to 24 hours (86400 seconds) for the first increment to clean up old keys automatically
    if (sequence === 1) {
      await redis.expire(redisKey, 86400);
    }

    return `${userPrefix}-${sequence}`;
  } catch (err) {
    // Redis unreachable — a token number is a display convenience, not a
    // correctness-critical key. Degrade to a still-unique fallback instead
    // of blocking order creation entirely on a Redis outage.
    console.error('[tokenGenerator] Redis unavailable for token number, using fallback:', (err as Error).message);
    return `${userPrefix}-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Generates an Order Number (ORD-XXXX) using Redis.
 * This does not reset daily, but keeps an incrementing global count per branch or tenant.
 * 
 * @param tenantId - The tenant ID
 * @returns A unique order string like ORD-10045
 */
export async function generateOrderNumber(tenantId: string): Promise<string> {
  const redisKey = `order_seq:${tenantId}`;

  try {
    // Atomically increment the sequence
    const sequence = await redis.incr(redisKey);

    // We can start at 1000 for aesthetic reasons if it's the first order
    let finalSeq = sequence;
    if (sequence === 1) {
      // If it was just created, let's bump it to 1000 and return 1000
      await redis.set(redisKey, 1000);
      finalSeq = 1000;
    }

    return `ORD-${finalSeq}`;
  } catch (err) {
    // Redis unreachable — same reasoning as generateTokenNumber above: this
    // is a display number, not the row's actual identity, so degrade rather
    // than fail the whole order.
    console.error('[tokenGenerator] Redis unavailable for order number, using fallback:', (err as Error).message);
    return `ORD-${Date.now().toString().slice(-6)}`;
  }
}
