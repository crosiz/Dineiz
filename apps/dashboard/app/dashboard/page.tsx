'use client';

import React from 'react';
import { useUser } from '@/contexts/user-context';
import { TenantAdminDashboard } from './tenant-admin-dashboard';
import { BranchManagerDashboard } from './branch-manager-dashboard';

export default function DashboardPage() {
  const { role } = useUser();

  if (role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER') {
    return <TenantAdminDashboard />;
  }

  // Fallback for other roles (like Cashier if they somehow bypassed the redirect)
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-xl font-bold">Unauthorized</h1>
    </div>
  );
}
