-- Fix 2: request-level idempotency for POST /api/orders and
-- POST /api/orders/:id/items — the two endpoints where a retried request
-- duplicates a row rather than harmlessly re-applying. No FK relation to
-- Tenant on purpose: this is a short-lived retry-safety cache, not a
-- durable business record.
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- Phase 6: server-side record of a POS terminal's POISONED outbox events
-- (lib/core/outbox.ts), so an admin dashboard can surface "this order never
-- reached the server" without inspecting the terminal's own IndexedDB.
CREATE TABLE "PosDeadLetter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL,
    "lastError" TEXT,
    "poisonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");
CREATE UNIQUE INDEX "IdempotencyKey_tenantId_endpoint_key_key" ON "IdempotencyKey"("tenantId", "endpoint", "key");
CREATE INDEX "PosDeadLetter_tenantId_branchId_resolvedAt_idx" ON "PosDeadLetter"("tenantId", "branchId", "resolvedAt");
CREATE UNIQUE INDEX "PosDeadLetter_tenantId_eventId_key" ON "PosDeadLetter"("tenantId", "eventId");
