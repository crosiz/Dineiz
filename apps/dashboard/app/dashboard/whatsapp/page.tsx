'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { AdminOnly } from '@/components/admin-only';
import { WhatsAppTabs } from './_components/WhatsAppTabs';
import { PageLoader } from '@/components/ui/Spinner';

export default function WhatsAppBotPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading: loading } = useQuery<any>({
    queryKey: ['whatsapp', 'config'],
    queryFn: async () => {
      const res = await apiFetch<{ config: any }>('/api/whatsapp/config');
      return res.config;
    },
  });

  const fetchConfig = () => queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });

  if (loading) {
    return <PageLoader label="Loading WhatsApp bot settings..." variant="tabs" />;
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
