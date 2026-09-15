-- Phase 5 of the POS Correctness & Sync program — POS Settings screen +
-- Part 13 admin settings. Hand-authored. All additive, defaulted columns.

ALTER TABLE "TenantBranding" ADD COLUMN "allowLoginWithoutShift"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantBranding" ADD COLUMN "allowOrderReopen"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantBranding" ADD COLUMN "orderReopenWindowMinutes"    INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "TenantBranding" ADD COLUMN "staleShiftWarnHours"         INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "TenantBranding" ADD COLUMN "autoCloseAbandonedHours"     INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "TenantBranding" ADD COLUMN "cashCountRequired"           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantBranding" ADD COLUMN "varianceAlertThreshold"     DOUBLE PRECISION NOT NULL DEFAULT 500;

ALTER TABLE "TenantBranding" ADD COLUMN "managerOverlayEnabled"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantBranding" ADD COLUMN "managerOverlayIdleMinutes"   INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "TenantBranding" ADD COLUMN "managerOverlayRequireReason" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TenantBranding" ADD COLUMN "syncBatchSize"               INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "TenantBranding" ADD COLUMN "syncRequestTimeoutMs"        INTEGER NOT NULL DEFAULT 8000;
ALTER TABLE "TenantBranding" ADD COLUMN "syncMaxEventLifetimeHours"   INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "TenantBranding" ADD COLUMN "shiftCloseSyncTimeoutSec"    INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "TenantBranding" ADD COLUMN "allowCloseWithUnsynced"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantBranding" ADD COLUMN "closeWithUnsyncedRequiresPin" BOOLEAN NOT NULL DEFAULT true;
