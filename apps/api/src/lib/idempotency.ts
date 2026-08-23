import { prisma } from '@dineiz/db';

// Request-level idempotency for endpoints where a retried request
// duplicates a row rather than harmlessly re-applying (order creation,
// item append). A client sends the same key on a retry of the exact same
// logical request — the second arrival gets the first one's cached
// response back without the handler running again.
//
// Deliberately request-scoped, not event-scoped: it doesn't know or care
// about the POS event log's own retry/backoff bookkeeping (lib/core/
// outbox.ts on the client) — it just makes "the same key hit this
// endpoint twice" a no-op the second time, which is exactly what a
// timed-out-but-actually-succeeded request needs.
export async function withIdempotency<T extends { statusCode: number; body: any }>(
  tenantId: string,
  endpoint: string,
  key: string | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (!key) return run();

  const existing = await prisma.idempotencyKey.findUnique({
    where: { tenantId_endpoint_key: { tenantId, endpoint, key } },
  });
  if (existing) {
    return { statusCode: existing.statusCode, body: existing.response } as T;
  }

  const result = await run();

  // Only cache genuine successes — a validation error or a transient
  // failure shouldn't get "remembered" and replayed forever; the client
  // should be free to retry those with a fresh attempt.
  if (result.statusCode >= 200 && result.statusCode < 300) {
    await prisma.idempotencyKey
      .create({ data: { tenantId, endpoint, key, statusCode: result.statusCode, response: result.body } })
      // A second request with the same key can race this one and lose the
      // unique-constraint race — that's fine, it means the winner already
      // cached the same response we're about to return anyway.
      .catch(() => {});
  }

  return result;
}
