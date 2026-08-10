'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Input } from '@dineiz/ui/src/components/input';
import { Button } from '@dineiz/ui/src/components/button';

export function ConfigurationTab({ settings, onRefresh }: { settings: any, onRefresh: () => void }) {
  const [formData, setFormData] = useState(settings || {});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      alert('Settings saved successfully');
      onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Earning Rules</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Earn Points</label>
            <Input
              type="number"
              value={formData.baseEarnRatePoints || 0}
              onChange={(e) => handleChange('baseEarnRatePoints', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Per PKR Spent</label>
            <Input
              type="number"
              value={formData.baseEarnRateSpend || 0}
              onChange={(e) => handleChange('baseEarnRateSpend', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order Value to Earn (PKR)</label>
          <Input
            type="number"
            value={formData.minOrderValue || 0}
            onChange={(e) => handleChange('minOrderValue', Number(e.target.value))}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tier Recalculation Method</label>
          <select 
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
            value={formData.tierRecalculationMethod || 'LIFETIME'}
            onChange={(e) => handleChange('tierRecalculationMethod', e.target.value)}
          >
            <option value="LIFETIME">Lifetime (Never Expires)</option>
            <option value="MONTHLY">Monthly (Rolling 12 Months)</option>
          </select>
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Redemption Rules</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Points to Redeem</label>
          <Input
            type="number"
            value={formData.minPointsToRedeem || 0}
            onChange={(e) => handleChange('minPointsToRedeem', Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Value (Points)</label>
            <Input
              type="number"
              value={formData.redemptionValuePoints || 0}
              onChange={(e) => handleChange('redemptionValuePoints', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value in PKR</label>
            <Input
              type="number"
              value={formData.redemptionValuePkr || 0}
              onChange={(e) => handleChange('redemptionValuePkr', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mb-4 flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={formData.requireFullPaymentBeforeRedeeming || false}
            onChange={(e) => handleChange('requireFullPaymentBeforeRedeeming', e.target.checked)}
          />
          <label className="text-sm font-medium text-gray-700">Require full payment before redeeming</label>
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>
      
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
