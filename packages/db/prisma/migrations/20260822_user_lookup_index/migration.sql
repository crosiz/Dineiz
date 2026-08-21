-- CreateIndex
-- Staff-list and PIN-login lookups filter on (tenantId, branchId, role) with
-- no supporting index — every other hot-path model (Order, Shift, Customer)
-- already has one. This was a hand-authored migration since this worktree
-- has no live DATABASE_URL/DIRECT_URL to run `prisma migrate dev` against;
-- run `prisma migrate deploy` wherever those are configured.
CREATE INDEX "User_tenantId_branchId_role_idx" ON "User"("tenantId", "branchId", "role");
