'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const DEFAULT_DAY = { isOpen: true, open: '11:00', close: '23:00' };

export function OperatingHoursTab({ config, onRefresh }: { config: any; onRefresh: () => void }) {
  const [hours, setHours] = useState<Record<string, { isOpen: boolean; open: string; close: string }>>(
    config?.operatingHours || Object.fromEntries(DAYS.map((d) => [d.key, DEFAULT_DAY])),
  );
  const [awayMessage, setAwayMessage] = useState(config?.awayMessage || '');
  const [loading, setLoading] = useState(false);

  const updateDay = (key: string, patch: Partial<{ isOpen: boolean; open: string; close: string }>) => {
    setHours((prev) => ({ ...prev, [key]: { ...(prev[key] || DEFAULT_DAY), ...patch } }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify({ operatingHours: hours, awayMessage }),
      });
      alert('Operating hours saved');
      onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to save operating hours');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Operating Hours</h2>
        <p className="text-sm text-gray-500 mb-4">When a customer messages outside these hours, the bot sends your away message instead of taking an order.</p>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const value = hours[day.key] || DEFAULT_DAY;
            return (
              <div key={day.key} className="flex items-center gap-4 border border-gray-100 rounded-xl p-3">
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={value.isOpen}
                    onChange={(e) => updateDay(day.key, { isOpen: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
                </label>
                <span className="w-24 text-sm font-semibold text-gray-700 shrink-0">{day.label}</span>
                {value.isOpen ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={value.open}
                      onChange={(e) => updateDay(day.key, { open: e.target.value })}
                      className="border border-gray-200 rounded-lg p-2 text-sm"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                      type="time"
                      value={value.close}
                      onChange={(e) => updateDay(day.key, { close: e.target.value })}
                      className="border border-gray-200 rounded-lg p-2 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 flex-1">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full h-px bg-gray-100"></div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Away Message</label>
        <textarea
          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
          rows={3}
          placeholder="We are currently closed. Please order during our operating hours."
          value={awayMessage}
          onChange={(e) => setAwayMessage(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Hours'}
        </Button>
      </div>
    </div>
  );
}
