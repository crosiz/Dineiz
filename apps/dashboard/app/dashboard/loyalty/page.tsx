'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { LoyaltyTabs } from './_components/LoyaltyTabs';
import { AdminOnly } from '@/components/admin-only';
import { PageLoader } from '@/components/ui/Spinner';
import { Sparkles, PauseCircle } from 'lucide-react';

export default function LoyaltyPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['loyalty', 'settings'],
    queryFn: () => apiFetch<any>('/api/loyalty/settings'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['loyalty', 'settings'] });

  const handleEnable = async () => {
    try {
      await apiFetch('/api/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          pointsPerCurrency: 1,
          redemptionRate: 0.1,
          expiryDays: 365,
        }),
      });
      refresh();
    } catch (e) {
      alert('Failed to enable loyalty program');
    }
  };

  if (isLoading) {
    return <PageLoader label="Loading loyalty program..." variant="tabs" />;
  }

  if (!settings?.isActive) {
    return (
      <AdminOnly>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-5">
          <div className="w-16 h-16 bg-[#FF5722]/10 rounded-2xl flex items-center justify-center border border-[#FF5722]/20">
            <Sparkles className="text-[#FF5722]" size={32} />
          </div>
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Customer Loyalty Program</h1>
            <p className="text-slate-500 text-xs">
              Increase repeat visits by rewarding your best customers with points, tiered rewards, and exclusive member campaigns.
            </p>
          </div>
          <button
            onClick={handleEnable}
            className="h-10 px-5 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Set Up Loyalty Program
          </button>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="text-[#FF5722]" size={22} />
              Loyalty & Rewards Program
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage earn rules, membership tiers, and promotional bonus campaigns</p>
          </div>
          <div>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to pause the loyalty program?')) {
                  await apiFetch('/api/loyalty/settings', {
                    method: 'PUT',
                    body: JSON.stringify({ ...settings, isActive: false })
                  });
                  refresh();
                }
              }}
              className="h-9 px-3.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
            >
              <PauseCircle size={15} />
              Pause Program
            </button>
          </div>
        </div>

        <LoyaltyTabs settings={settings} onRefresh={refresh} />
      </div>
    </AdminOnly>
  );
}
