'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { LoyaltyTabs } from './_components/LoyaltyTabs';
import { useBranchFilter } from '@/hooks/useBranchFilter';

export default function LoyaltyProgramPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const { branchId, queryParam } = useBranchFilter();

  const fetchSettings = async () => {
    try {
      const res = await apiFetch<any>(`/api/loyalty/settings${queryParam ? `?${queryParam}` : ''}`);
      setSettings(res.settings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [branchId]);

  const handleEnable = async () => {
    try {
      setLoading(true);
      await apiFetch('/api/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          baseEarnRatePoints: 1,
          baseEarnRateSpend: 10,
          minOrderValue: 0,
          allowedOrderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'],
          isolateBranches: false,
          expiryType: 'MONTHS',
          expiryMonths: 12,
          minPointsToRedeem: 100,
          redemptionValuePoints: 100,
          redemptionValuePkr: 10,
          requireFullPaymentBeforeRedeeming: false,
          tierRecalculationMethod: 'LIFETIME'
        })
      });
      await fetchSettings();
    } catch (e) {
      alert('Failed to enable loyalty program');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!settings?.isActive) {
    return (
      <AdminOnly>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="w-20 h-20 bg-[#FF5722]/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#FF5722]">stars</span>
          </div>
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Loyalty Program</h1>
            <p className="text-gray-500 text-sm">
              Increase repeat visits by rewarding your best customers. Points, tiers, and exclusive deals.
            </p>
          </div>
          <button
            onClick={handleEnable}
            className="px-6 py-3 bg-[#FF5722] hover:bg-[#E64A19] text-white font-semibold rounded-xl shadow-lg transition-colors"
          >
            Set Up Loyalty Program
          </button>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loyalty Program</h1>
            <p className="text-sm text-gray-500">Manage rules, tiers, and campaigns.</p>
          </div>
          <div>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to pause the loyalty program?')) {
                  await apiFetch('/api/loyalty/settings', {
                    method: 'PUT',
                    body: JSON.stringify({ ...settings, isActive: false })
                  });
                  fetchSettings();
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors"
            >
              Pause Program
            </button>
          </div>
        </div>

        <LoyaltyTabs settings={settings} onRefresh={fetchSettings} />
      </div>
    </AdminOnly>
  );
}
