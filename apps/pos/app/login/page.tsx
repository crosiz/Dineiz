import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

// No server-side DB lookup here, deliberately. It only seeded `branchName` for
// the very first paint, and LoginClient overwrites that from GET /api/pos/staff
// the moment it mounts — so the value was cosmetic and lived for one frame.
//
// The real problem it caused: `await prisma.branch.findFirst()` blocks the RSC
// render of this page. Neon is serverless and cold-starts (or is briefly
// unreachable) regularly, and when a cashier's session expires, every /pos/*
// route redirects here via a *client-side* router transition. A stalled Prisma
// await inside that transition desyncs hydration — React replays Next's own
// <Router> and throws "Rendered more hooks than during the previous render",
// leaving a blank page. Dropping the call removes the stall entirely; the env
// default covers the first paint until LoginClient's fetch lands.
export default function LoginPage() {
  const defaultBranchId = process.env.NEXT_PUBLIC_BRANCH_ID || 'branch-main-001';

  return (
    <Suspense fallback={null}>
      <LoginClient branchId={defaultBranchId} branchName="Main Branch" />
    </Suspense>
  );
}
