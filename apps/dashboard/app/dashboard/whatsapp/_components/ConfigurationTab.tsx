'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Input } from '@dineiz/ui/src/components/input';
import { Button } from '@dineiz/ui/src/components/button';
import { useBranches } from '@/hooks/useBranches';

const ORDER_TYPES = ['TAKEAWAY', 'DELIVERY'] as const;

export function ConfigurationTab({ config, onRefresh }: { config: any; onRefresh: () => void }) {
  const [formData, setFormData] = useState(config || {});
  const [loading, setLoading] = useState(false);
  const { data: branches = [] } = useBranches();

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const toggleOrderType = (type: string) => {
    const current: string[] = formData.allowedOrderTypes || [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    handleChange('allowedOrderTypes', next);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify(formData),
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
        <h2 className="text-xl font-bold text-gray-900 mb-1">Bot Status</h2>
        <p className="text-sm text-gray-500 mb-4">The bot responds to all messages when enabled. Turn off during technical issues or holidays.</p>
        <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4">
          <div>
            <p className="font-semibold text-gray-900">{formData.isEnabled ? 'Bot is live' : 'Bot is offline'}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={!!formData.isEnabled}
              onChange={(e) => handleChange('isEnabled', e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
          </label>
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Bot Identity</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bot Name</label>
          <Input
            value={formData.botName || ''}
            placeholder="e.g. Ahmed"
            onChange={(e) => handleChange('botName', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">The bot introduces itself as this name, e.g. "Hi! I'm {formData.botName || 'Assistant'}".</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch Assignment</label>
          <select
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
            value={formData.defaultBranchId || ''}
            onChange={(e) => handleChange('defaultBranchId', e.target.value || null)}
          >
            <option value="">Select which branch handles WhatsApp orders</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Meta WhatsApp Cloud API</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
            <Input
              value={formData.metaPhoneNumberId || ''}
              placeholder="From the Meta developer console"
              onChange={(e) => handleChange('metaPhoneNumberId', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
            <Input
              type="password"
              value={formData.metaAccessToken || ''}
              placeholder="Meta API access token"
              onChange={(e) => handleChange('metaAccessToken', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Types</h2>
        <div className="flex gap-4 mb-4">
          {ORDER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(formData.allowedOrderTypes || []).includes(type)}
                onChange={() => toggleOrderType(type)}
              />
              <span className="text-sm font-medium text-gray-700">{type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}</span>
            </label>
          ))}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order Amount (PKR)</label>
          <Input
            type="number"
            value={formData.minOrderAmount ?? 0}
            onChange={(e) => handleChange('minOrderAmount', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Payment Methods</h2>
        <p className="text-sm text-gray-500 mb-4">Cash on delivery / pay at counter is always available. JazzCash and EasyPaisa are coming in a future update.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between border border-gray-100 rounded-xl p-3 opacity-60">
            <span className="text-sm font-semibold text-gray-700">JazzCash</span>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input type="checkbox" className="sr-only peer" checked={!!formData.jazzCashEnabled} disabled />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-gray-400"></div>
            </label>
          </div>
          <div className="flex items-center justify-between border border-gray-100 rounded-xl p-3 opacity-60">
            <span className="text-sm font-semibold text-gray-700">EasyPaisa</span>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input type="checkbox" className="sr-only peer" checked={!!formData.easyPaisaEnabled} disabled />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-gray-400"></div>
            </label>
          </div>
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
