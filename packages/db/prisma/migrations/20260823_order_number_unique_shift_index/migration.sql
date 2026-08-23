-- Fix 4: orderNumber had zero DB-level uniqueness despite two independent,
-- differently-racy generators feeding it (Redis INCR with a Date.now()
-- fallback for POS, prisma.order.count() for mobile — both share the same
-- "ORD-" prefix, so they could collide with each other too, not just
-- internally). Verified no existing duplicates before adding this
-- (SELECT tenantId, orderNumber, COUNT(*) ... HAVING COUNT(*) > 1 returned
-- zero rows across 709 orders) — safe to add without a data-cleanup step.
-- The two order-creation call sites (order.service.ts's createOrder,
-- mobile/orders.ts) now retry with a freshly generated number on the
-- specific P2002 this constraint can now raise.
CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");

-- Phase 0: matches the exact where-clause shift.service.ts uses to find a
-- cashier's currently-open shift (checked on login, on shift-open, and on
-- every "is a shift already open?" conflict check) — was falling back to
-- the existing single-column indexes on Shift.
CREATE INDEX "Shift_tenantId_branchId_userId_status_idx" ON "Shift"("tenantId", "branchId", "userId", "status");
