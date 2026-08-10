'use client';

import React from 'react';
import { useAnalytics } from './hooks/useAnalytics';
import { AnalyticsTopBar } from './AnalyticsTopBar';
import { RevenueOverview } from './RevenueOverview';
import { RevenueBreakdown } from './RevenueBreakdown';
import { PeakHours } from './PeakHours';
import { MenuPerformance } from './MenuPerformance';
import { StaffPerformance } from './StaffPerformance';
import { CustomerAnalytics } from './CustomerAnalytics';
import { BranchComparison } from './BranchComparison';
import { ChartSkeleton } from '@/components/ui/skeleton';

export function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-64px)]">
        <AnalyticsTopBar />
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6 pb-20">
          <ChartSkeleton height={400} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <AnalyticsTopBar />
      
      <div className="p-6 max-w-7xl mx-auto w-full space-y-8 pb-20">
        {/* Section 1: Revenue Overview */}
        <RevenueOverview data={data} />
        
        {/* Section 2: Revenue Breakdown */}
        <RevenueBreakdown data={data.breakdowns} />
        
        {/* Section 3: Peak Hours */}
        <PeakHours data={data.hourly} />
        
        {/* Section 4: Menu Performance */}
        <MenuPerformance data={data.items} />
        
        {/* Section 5: Staff Performance */}
        <StaffPerformance data={data.staff} />
        
        {/* Section 6: Customer Analytics */}
        <CustomerAnalytics data={data.customers} />
        
        {/* Section 7: Branch Comparison */}
        <BranchComparison data={data.branchComparison} />
      </div>
    </div>
  );
}
