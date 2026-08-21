'use client';

import React, { useState } from 'react';
import { ConfigurationTab } from './ConfigurationTab';
import { TiersTab } from './TiersTab';
import { CampaignsTab } from './CampaignsTab';
import { MetricsTab } from './MetricsTab';
import { MembersTab } from './MembersTab';
import { BarChart3, Users, Settings, Award, Megaphone } from 'lucide-react';

export function LoyaltyTabs({ settings, onRefresh }: { settings: any, onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'config' | 'tiers' | 'campaigns' | 'dashboard' | 'members'>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Analytics', icon: BarChart3 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'tiers', label: 'Tiers', icon: Award },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit flex-wrap">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconComponent size={14} className={activeTab === tab.id ? 'text-[#FF5722]' : 'text-slate-400'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        {activeTab === 'dashboard' && <MetricsTab />}
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'config' && <ConfigurationTab settings={settings} onRefresh={onRefresh} />}
        {activeTab === 'tiers' && <TiersTab />}
        {activeTab === 'campaigns' && <CampaignsTab />}
      </div>
    </div>
  );
}

