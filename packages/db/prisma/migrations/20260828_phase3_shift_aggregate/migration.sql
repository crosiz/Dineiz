-- Phase 3 of the POS Correctness & Sync program — Financial Accuracy (spec Part 7).
--
-- Hand-authored (see 20260822_add_side_effect_latch for why the shadow-DB
-- path fails here). One new table, no changes to existing ones.

CREATE TABLE "ShiftAggregate" (
    "id"            TEXT NOT NULL,
    "shiftId"       TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "branchId"      TEXT NOT NULL,
    "orderCount"    INTEGER NOT NULL DEFAULT 0,
    "grossRevenue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxCollected"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashRevenue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardRevenue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherRevenue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundTotal"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voidCount"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShiftAggregate_shiftId_key" ON "ShiftAggregate"("shiftId");
CREATE INDEX "ShiftAggregate_tenantId_branchId_idx" ON "ShiftAggregate"("tenantId", "branchId");
CREATE INDEX "ShiftAggregate_tenantId_updatedAt_idx" ON "ShiftAggregate"("tenantId", "updatedAt");

ALTER TABLE "ShiftAggregate"
  ADD CONSTRAINT "ShiftAggregate_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
