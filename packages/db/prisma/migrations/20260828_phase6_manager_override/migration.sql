-- Phase 6 of the POS Correctness & Sync program — Manager Overlay (spec Part 10).
-- Hand-authored. One new table.

CREATE TABLE "ManagerOverride" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "branchId"    TEXT NOT NULL,
    "terminalId"  TEXT,
    "shiftId"     TEXT,
    "cashierId"   TEXT,
    "cashierName" TEXT,
    "managerId"   TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "reason"      TEXT,
    "oneShot"     BOOLEAN NOT NULL DEFAULT false,
    "actions"     JSONB NOT NULL DEFAULT '[]',
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"     TIMESTAMP(3),
    "durationSec" INTEGER,
    "exitReason"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagerOverride_tenantId_branchId_idx" ON "ManagerOverride"("tenantId", "branchId");
CREATE INDEX "ManagerOverride_shiftId_idx" ON "ManagerOverride"("shiftId");
CREATE INDEX "ManagerOverride_managerId_idx" ON "ManagerOverride"("managerId");
