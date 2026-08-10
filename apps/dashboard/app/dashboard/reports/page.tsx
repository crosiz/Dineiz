'use client';
import React, { useState } from 'react';
import { ReportSidebar } from './_components/ReportSidebar';
import { ReportConfigPanel } from './_components/ReportConfigPanel';
import { ScheduledReportsList } from './_components/ScheduledReportsList';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { AllBranchesBanner } from '@/components/AllBranchesBanner';

export type ReportType = 'TAX_REPORT' | 'SHIFT_BALANCE' | 'DAILY_SALES' | 'MONTHLY_REVENUE' | 'MENU_PERFORMANCE' | 'STAFF_PERFORMANCE' | 'SCHEDULED_REPORTS' | string;

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('SCHEDULED_REPORTS');
  const { isAllBranches } = useBranchFilter();

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Generate structured reports for accounting, compliance, and operations.</p>
      </div>
      
      <div className="px-6 pt-6">
        <AllBranchesBanner isAllBranches={isAllBranches} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Catalog */}
        <div className="w-[300px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <ReportSidebar selected={selectedReport} onSelect={setSelectedReport} />
        </div>
        
        {/* Right Panel: Config and Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedReport === 'SCHEDULED_REPORTS' ? (
            <ScheduledReportsList />
          ) : (
            <ReportConfigPanel type={selectedReport} />
          )}
        </div>
      </div>
    </div>
  );
}
