'use client';

import React, { useState } from 'react';
import { ConfigurationTab } from './ConfigurationTab';
import { TiersTab } from './TiersTab';
import { CampaignsTab } from './CampaignsTab';
import { MetricsTab } from './MetricsTab';
import { MembersTab } from './MembersTab';

export function LoyaltyTabs({ settings, onRefresh }: { settings: any, onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'config' | 'tiers' | 'campaigns' | 'dashboard' | 'members'>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'config', label: 'Configuration', icon: 'settings' },
    { id: 'tiers', label: 'Tiers', icon: 'military_tech' },
    { id: 'campaigns', label: 'Campaigns', icon: 'campaign' },
  ];

  return (
    <div>
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-max mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)]">
        {activeTab === 'dashboard' && <MetricsTab />}
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'config' && <ConfigurationTab settings={settings} onRefresh={onRefresh} />}
        {activeTab === 'tiers' && <TiersTab />}
        {activeTab === 'campaigns' && <CampaignsTab />}
      </div>
    </div>
  );
}
