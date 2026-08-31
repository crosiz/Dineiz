-- Phase 1 of the POS Correctness & Sync program.
--
-- Hand-authored: `prisma migrate dev --create-only`'s shadow-database replay
-- fails in this environment (see 20260822_add_side_effect_latch). Every column
-- here is additive and either nullable or defaulted, so this applies cleanly
-- to the populated dev DB with no backfill step.

-- Part 2 (Shift Ownership) — orphan adoption. When an order created under a
-- shift that has since closed, but is still PENDING/IN_KITCHEN/READY, gets
-- pulled into a live shift by a manager, these record it. Reports keep the
-- revenue attributed to "adoptedFromShiftId", not the adopting shift.
ALTER TABLE "Order" ADD COLUMN "adoptedFromShiftId" TEXT;
ALTER TABLE "Order" ADD COLUMN "adoptedByUserId" TEXT;

-- Part 3 — the guest has asked for the bill; drives the BILL_REQUESTED
-- derived table status.
ALTER TABLE "Order" ADD COLUMN "billRequestedAt" TIMESTAMP(3);

-- Part 3 (Table Status — Single Ownership). Status is derived from the orders
-- on a table; "statusOverride" is the only thing that beats the derivation and
-- is set + cleared explicitly by a manager. "lastCompletedAt" powers the
-- dirty -> free transition after TenantBranding.tableCleaningMinutes with no
-- background writer.
ALTER TABLE "Table" ADD COLUMN "statusOverride" TEXT;
ALTER TABLE "Table" ADD COLUMN "overrideAt" TIMESTAMP(3);
ALTER TABLE "Table" ADD COLUMN "lastCompletedAt" TIMESTAMP(3);

-- Part 4 (Order Numbers — One Generator, Configurable Format).
ALTER TABLE "TenantBranding" ADD COLUMN "orderNumberFormat" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "TenantBranding" ADD COLUMN "tenantShortCode" TEXT;
ALTER TABLE "TenantBranding" ADD COLUMN "tableCleaningMinutes" INTEGER NOT NULL DEFAULT 5;
