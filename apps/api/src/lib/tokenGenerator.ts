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
  
  // Atomically increment the sequence counter in Redis
  const sequence = await redis.incr(redisKey);
  
  // Set expiry to 24 hours (86400 seconds) for the first increment to clean up old keys automatically
  if (sequence === 1) {
    await redis.expire(redisKey, 86400);
  }

  // Extract the last 4 characters of the userId as an identifier
  const userPrefix = userId.slice(-4).toUpperCase();
  
  return `${userPrefix}-${sequence}`;
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
}
