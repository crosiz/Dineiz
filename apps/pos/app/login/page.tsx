import { Suspense } from 'react';
import { prisma } from '@dineiz/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const firstBranch = await prisma.branch.findFirst({
    orderBy: { name: 'asc' }
  });
  const defaultBranchId = firstBranch?.id || process.env.NEXT_PUBLIC_BRANCH_ID || 'branch-main-001';
  const branchName = firstBranch?.name || 'Main Branch';

  return (
    <Suspense fallback={null}>
      <LoginClient branchId={defaultBranchId} branchName={branchName} />
    </Suspense>
  );
}
