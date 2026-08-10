'use client';

import React from 'react';
import { useUser } from '@/contexts/user-context';
import { useBranchDashboard } from './hooks/useBranchDashboard';
import { BranchBanner } from './BranchBanner';
import { BranchKPIGrid } from './BranchKPIGrid';
import { LiveOrderStatusSection } from './LiveOrderStatusSection';
import { HourlyOrdersChart } from './HourlyOrdersChart';
import { BranchRecentOrdersTable } from './BranchRecentOrdersTable';

export function BranchManagerDashboard() {
  const { name, role } = useUser();
  const {
    shift, kpis, tableData, heatmap, recentOrders, liveCounts,
    isLoadingKpis, isLoadingOrders, isLoadingHeatmap,
  } = useBranchDashboard();

  const branchName = role === 'BRANCH_MANAGER' && name ? `${name}'s Branch` : 'Main Branch';

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. Branch Banner */}
      <BranchBanner shift={shift} branchName={branchName} />

      {/* 2. KPI Cards */}
      <BranchKPIGrid kpis={kpis} tableData={tableData} isLoading={isLoadingKpis} />

      {/* 3. Live Order Status */}
      <LiveOrderStatusSection counts={liveCounts} />

      {/* 4. Hourly Chart */}
      <HourlyOrdersChart heatmap={heatmap} isLoading={isLoadingHeatmap} />

      {/* 5. Recent Orders */}
      <BranchRecentOrdersTable orders={recentOrders} isLoading={isLoadingOrders} />
    </div>
  );
}
