'use client';

import React, { useState } from 'react';
import { OverviewTab } from './OverviewTab';
import { ConfigurationTab } from './ConfigurationTab';
import { OperatingHoursTab } from './OperatingHoursTab';
import { MenuVisibilityTab } from './MenuVisibilityTab';
import { BarChart3, Settings, Clock, UtensilsCrossed } from 'lucide-react';

export function WhatsAppTabs({ config, onRefresh }: { config: any; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'hours' | 'menu'>('overview');

  const tabs = [
    { id: 'overview', label: 'Analytics', icon: BarChart3 },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'hours', label: 'Operating Hours', icon: Clock },
    { id: 'menu', label: 'Menu Visibility', icon: UtensilsCrossed },
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
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'config' && <ConfigurationTab config={config} onRefresh={onRefresh} />}
        {activeTab === 'hours' && <OperatingHoursTab config={config} onRefresh={onRefresh} />}
        {activeTab === 'menu' && <MenuVisibilityTab config={config} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

