-- Phase 4 of the POS Correctness & Sync program — Shift Close UX (spec Part 6).
--
-- Hand-authored. A shift can now be closed on the terminal while some of its
-- events are still queued for the server; it sits in PENDING_SYNC until the
-- last one confirms.

ALTER TYPE "ShiftStatus" ADD VALUE IF NOT EXISTS 'PENDING_SYNC';

ALTER TABLE "Shift" ADD COLUMN "pendingSyncAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "pendingSyncCount" INTEGER;
