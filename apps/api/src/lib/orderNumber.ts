import { redis } from './redis';
import { prisma } from '@dineiz/db';

// ─── Order numbers: one generator, one format (spec Part 4) ─────────────────
//
// The POS terminal owns its own order numbers — it mints them locally in
// apps/pos/lib/core/event-log.ts the instant an order is created, and the
// server trusts that value verbatim (see createOrder). This module is the
// *other* half: the one place every NON-POS source (WhatsApp, QR, Foodpanda,
// Careem, Talabat, mobile app, kiosk) and every server-side fallback runs
// through, so a number looks the same shape no matter where the order came
// from and there is never a second generator quietly inventing a different
// scheme.

export type OrderNumberFormat = 'SHORT' | 'STANDARD' | 'DETAILED';

export const SOURCE_PREFIX: Record<string, string> = {
  POS: 'A',
  WHATSAPP: 'W',
  QR_CODE: 'Q',
  KIOSK: 'K',
  FOODPANDA: 'F',
  CAREEM: 'C',
  TALABAT: 'T',
  MOBILE: 'M',
};

/** DETAILED uses this; keep it short so the whole number stays <= 16 chars. */
export function sanitizeShortCode(code: string | null | undefined): string {
  return (code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * Pure formatter. `seq` is already resolved by the caller (per-shift for
 * SHORT, per-day for STANDARD/DETAILED).
 *
 *   SHORT     A-047
 *   STANDARD  A-0912-047      (DDMM)
 *   DETAILED  KBJ-A-250912-047 (YYMMDD)
 */
export function formatOrderNumber(opts: {
  format: OrderNumberFormat;
  prefix: string;
  seq: number;
  date?: Date;
  shortCode?: string | null;
}): string {
  const { format, prefix, seq } = opts;
  const d = opts.date ?? new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);

  if (format === 'SHORT') return `${prefix}-${pad3(seq)}`;
  if (format === 'DETAILED') {
    const code = sanitizeShortCode(opts.shortCode);
    const head = code ? `${code}-` : '';
    return `${head}${prefix}-${yy}${mm}${dd}-${pad3(seq)}`;
  }
  // STANDARD (default)
  return `${prefix}-${dd}${mm}-${pad3(seq)}`;
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Next order number for a non-POS source. Sequence is per source, per day,
 * held in Redis (INCR + 24h TTL); on a Redis outage it falls back to a
 * same-day COUNT against the DB + a random jitter so two concurrent orders
 * during the outage don't collide. The caller still retries on the
 * @@unique([tenantId, orderNumber]) constraint as a final backstop.
 */
export async function nextNonPosOrderNumber(args: {
  tenantId: string;
  source: string;
  format: OrderNumberFormat;
  shortCode?: string | null;
}): Promise<string> {
  const prefix = SOURCE_PREFIX[args.source] ?? 'X';
  const day = todayKey();
  const key = `ordseq:${args.tenantId}:${prefix}:${day}`;

  let seq: number;
  try {
    seq = await redis.incr(key);
    if (seq === 1) await redis.expire(key, 86400);
  } catch (err) {
    console.error('[orderNumber] Redis unavailable, using DB-count fallback:', (err as Error).message);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const count = await prisma.order
      .count({ where: { tenantId: args.tenantId, createdAt: { gte: start }, orderNumber: { startsWith: `${prefix}-` } } })
      .catch(() => 0);
    seq = count + 1 + Math.floor(Math.random() * 5);
  }

  return formatOrderNumber({ format: args.format, prefix, seq, shortCode: args.shortCode });
}
