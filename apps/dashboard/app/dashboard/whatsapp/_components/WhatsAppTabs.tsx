'use client';

import React, { useState } from 'react';
import { OverviewTab } from './OverviewTab';
import { ConfigurationTab } from './ConfigurationTab';
import { OperatingHoursTab } from './OperatingHoursTab';
import { MenuVisibilityTab } from './MenuVisibilityTab';

export function WhatsAppTabs({ config, onRefresh }: { config: any; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'hours' | 'menu'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'bar_chart' },
    { id: 'config', label: 'Configuration', icon: 'settings' },
    { id: 'hours', label: 'Operating Hours', icon: 'schedule' },
    { id: 'menu', label: 'Menu Visibility', icon: 'restaurant_menu' },
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
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'config' && <ConfigurationTab config={config} onRefresh={onRefresh} />}
        {activeTab === 'hours' && <OperatingHoursTab config={config} onRefresh={onRefresh} />}
        {activeTab === 'menu' && <MenuVisibilityTab config={config} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
