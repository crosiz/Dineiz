import { Suspense } from 'react';
import { prisma } from '@dineiz/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  let defaultBranchId = process.env.NEXT_PUBLIC_BRANCH_ID || 'branch-main-001';
  let branchName = 'Main Branch';

  try {
    if (process.env.DATABASE_URL) {
      const firstBranch = await prisma.branch.findFirst({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      if (firstBranch) {
        defaultBranchId = firstBranch.id;
        branchName = firstBranch.name;
      }
    }
  } catch (error) {
    console.error('[LoginPage] DB lookup failed, falling back to defaults:', error);
  }

  return (
    <Suspense fallback={null}>
      <LoginClient branchId={defaultBranchId} branchName={branchName} />
    </Suspense>
  );
}
