'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { WhatsAppTabs } from './_components/WhatsAppTabs';

export default function WhatsAppBotPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);

  const fetchConfig = async () => {
    try {
      const res = await apiFetch<{ config: any }>('/api/whatsapp/config');
      setConfig(res.config);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <AdminOnly>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Bot</h1>
            <p className="text-sm text-gray-500">Let customers order over WhatsApp — AI-driven menu, cart, and cash-on-delivery checkout.</p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${config?.isEnabled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {config?.isEnabled ? 'Bot is live' : 'Bot is offline'}
          </div>
        </div>

        <WhatsAppTabs config={config} onRefresh={fetchConfig} />
      </div>
    </AdminOnly>
  );
}
