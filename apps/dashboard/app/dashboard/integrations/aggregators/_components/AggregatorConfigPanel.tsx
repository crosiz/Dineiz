'use client';
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';
import { X, Save, RefreshCw, Check, Link as LinkIcon, Search } from 'lucide-react';
import { useDashboardContext } from '@/contexts/dashboard-context';

const FoodpandaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full p-1 text-[#D70F64]">
    <path d="M4.224 0a3.14 3.14 0 00-3.14 3.127 3.1 3.1 0 001.079 2.36 11.811 11.811 0 00-2.037 6.639C.126 18.68 5.458 24 12 24c6.542 0 11.874-5.32 11.874-11.874a11.69 11.69 0 00-2.025-6.614 3.136 3.136 0 001.09-2.373A3.132 3.132 0 0019.8.012a3.118 3.118 0 00-2.636 1.438A11.792 11.792 0 0012.012.264c-1.845 0-3.595.419-5.152 1.174A3.133 3.133 0 004.224 0zM12 1.198c1.713 0 3.331.396 4.78 1.102a10.995 10.995 0 014.29 3.715 10.89 10.89 0 011.882 6.135c.011 6.039-4.901 10.951-10.94 10.951-6.04 0-10.951-4.912-10.951-10.951 0-2.277.694-4.386 1.88-6.135A11.08 11.08 0 017.232 2.3 10.773 10.773 0 0112 1.198zM7.367 6.345c-.853.012-1.743.292-2.28.653-1.031.682-2.29 2.156-2.085 4.181.191 2.025 1.785 3.283 2.612 3.283.826 0 1.234-.42 1.485-1.45.252-1.018 1.115-2.192 2.217-3.45s-.024-2.469-.024-2.469c-.393-.513-1.052-.727-1.755-.747a3.952 3.952 0 00-.17-.001zm9.233.007l-.17.001c-.702.02-1.358.233-1.746.752 0 0-1.126 1.21-.024 2.469 1.114 1.258 1.965 2.432 2.217 3.45.251 1.019.659 1.438 1.485 1.45.827 0 2.409-1.258 2.612-3.283.204-2.025-1.054-3.51-2.084-4.182-.544-.36-1.437-.643-2.29-.657zm-8.962 2c.348 0 .624.275.624.623-.012.335-.288.623-.624.623a.619.619 0 01-.623-.623c0-.348.276-.624.623-.624zm8.891 0c.348 0 .623.275.623.623-.012.335-.287.623-.623.623a.619.619 0 01-.623-.623c0-.348.288-.624.623-.624zm-4.541 4.025c-.527 0-2.06.096-2.06.587 0 .887 1.88 1.522 2.06 1.474.18.048 2.06-.587 2.06-1.474 0-.49-1.52-.587-2.06-.587zM9.076 15.17c0 1.414 1.294 2.564 2.912 2.564 1.618 0 2.924-1.15 2.924-2.564z"/>
  </svg>
);

const CareemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-2 text-[#47A23F]">
    <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8.9 6.5 2.5" />
    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const TalabatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full p-1.5 text-[#FF5A00]">
    <path d="M14 2c-3 0-5 2.5-5 6v2H6v4h3v8h4v-8h4v-4h-4V8c0-1.5 1-2 2-2h2V2h-3z" />
  </svg>
);

export function AggregatorConfigPanel({ provider, integration, onClose }: { provider: string, integration: any, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'credentials' | 'mapping' | 'settings' | 'webhook'>('credentials');
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center`}>
              {provider === 'foodpanda' ? <FoodpandaIcon /> : provider === 'careem' ? <CareemIcon /> : <TalabatIcon />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 capitalize">{provider} Integration</h2>
              <p className="text-xs text-slate-500">Configure connection and mapping</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-100">
          {['credentials', 'mapping', 'settings', 'webhook'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-bold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === 'credentials' && <CredentialsTab provider={provider} integration={integration} />}
          {activeTab === 'mapping' && <MappingTab provider={provider} />}
          {activeTab === 'settings' && <SettingsTab provider={provider} integration={integration} />}
          {activeTab === 'webhook' && <WebhookTab provider={provider} />}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// TAB COMPONENTS
// --------------------------------------------------------------------------------

function CredentialsTab({ provider, integration }: any) {
  const [restaurantId, setRestaurantId] = useState(integration?.restaurantId || '');
  const [apiKey, setApiKey] = useState(integration?.apiKey || '');
  
  const saveMutation = useMutation({
    mutationFn: (data: any) => apiPost('/api/aggregators/integrations', data)
  });

  const handleSave = () => {
    if (!restaurantId || !apiKey) {
      alert('Please enter both Restaurant ID and API Key.');
      return;
    }
    saveMutation.mutate({ provider, restaurantId, apiKey, status: 'CONNECTED' }, {
      onSuccess: () => alert('Credentials saved and connected!')
    });
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      saveMutation.mutate({ provider, status: 'DISCONNECTED' }, {
        onSuccess: () => alert('Integration disconnected!')
      });
    }
  };

  const isConnected = integration?.status === 'CONNECTED';

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Restaurant ID</label>
        <input 
          type="text" 
          value={restaurantId}
          onChange={e => setRestaurantId(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-brand-primary outline-none"
          placeholder={`Your ${provider} Restaurant ID`}
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">API Key</label>
        <input 
          type="password" 
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-brand-primary outline-none"
          placeholder={`Your ${provider} API Key`}
        />
      </div>
      
      <div className="pt-4 flex gap-3">
        <button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-brand-primary text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-brand-primary/90 flex items-center gap-2"
        >
          <Save size={16} /> {isConnected ? 'Update Credentials' : 'Save & Connect'}
        </button>
        {isConnected && (
          <button 
            onClick={handleDisconnect}
            disabled={saveMutation.isPending}
            className="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-100 flex items-center gap-2"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function MappingTab({ provider }: { provider: string }) {
  const { data: mappingsData, refetch } = useQuery({
    queryKey: ['aggregator-mappings', provider],
    queryFn: () => apiGet<{ mappings: any[] }>(`/api/aggregators/mappings/${provider}`)
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu-items-all'],
    queryFn: () => apiGet<{ categories: any[] }>('/api/menu')
  });

  const allItems = menuData?.categories?.flatMap((c: any) => c.items) || [];
  const [search, setSearch] = useState('');

  // Local state for edits
  const [edits, setEdits] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiPost(`/api/aggregators/mappings/${provider}`, data)
  });

  const handleSave = () => {
    if (!mappingsData?.mappings) return;
    const payload = mappingsData.mappings.map(m => ({
      aggregatorItemId: m.aggregatorItemId,
      aggregatorItemName: m.aggregatorItemName,
      itemId: edits[m.aggregatorItemId] !== undefined ? edits[m.aggregatorItemId] : m.itemId,
      priceModifier: m.priceModifier
    }));
    
    saveMutation.mutate(payload, {
      onSuccess: () => {
        alert('Mappings saved!');
        refetch();
        setEdits({});
      }
    });
  };

  const handleAutoMap = () => {
    if (!mappingsData?.mappings) return;
    const newEdits = { ...edits };
    let matches = 0;
    mappingsData.mappings.forEach(m => {
      if (!m.itemId && !newEdits[m.aggregatorItemId]) {
        // Simple fuzzy match: lower case and remove spaces
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = norm(m.aggregatorItemName);
        const match = allItems.find((i: any) => norm(i.name) === target || target.includes(norm(i.name)));
        if (match) {
          newEdits[m.aggregatorItemId] = match.id;
          matches++;
        }
      }
    });
    setEdits(newEdits);
    alert(`Auto-mapped ${matches} items!`);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..." 
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleAutoMap} className="text-brand-primary font-bold text-sm flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 rounded-md hover:bg-brand-primary/20">
            <LinkIcon size={14} /> Auto-map All
          </button>
          <button onClick={handleSave} className="bg-orange-500 text-white font-bold text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-orange-600 transition-colors">
            <Save size={14} /> Save Mappings
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">External Item (Aggregator)</th>
              <th className="px-4 py-3">Internal Item (Dineiz)</th>
              <th className="px-4 py-3 w-32">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mappingsData?.mappings?.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No items fetched yet. Once an order arrives, unmapped items will appear here.
                </td>
              </tr>
            ) : (
              mappingsData?.mappings?.map((m: any) => {
                const currentItemId = edits[m.aggregatorItemId] !== undefined ? edits[m.aggregatorItemId] : m.itemId;
                return (
                  <tr key={m.aggregatorItemId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {m.aggregatorItemName}
                      <div className="text-[10px] text-slate-400 font-normal">ID: {m.aggregatorItemId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={currentItemId || ''}
                        onChange={e => setEdits(prev => ({ ...prev, [m.aggregatorItemId]: e.target.value }))}
                        className="w-full max-w-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                      >
                        <option value="">-- Select Internal Item --</option>
                        {allItems.map((item: any) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {currentItemId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                          <Check size={12} /> MAPPED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                          <X size={12} /> UNMAPPED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ provider, integration }: any) {
  const [autoAccept, setAutoAccept] = useState(integration?.autoAccept || false);
  const [prepTime, setPrepTime] = useState(integration?.defaultPrepTime || 30);
  const [branchId, setBranchId] = useState(integration?.branchId || '');

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiGet<{ branches: any[] }>('/api/branches')
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiPost('/api/aggregators/integrations', data)
  });

  const handleSave = () => {
    saveMutation.mutate({ provider, autoAccept, defaultPrepTime: Number(prepTime), branchId }, {
      onSuccess: () => alert('Settings saved!')
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">Auto-Accept Orders</h4>
          <p className="text-xs text-slate-500 mt-1">If enabled, incoming orders are automatically accepted and sent to the kitchen.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={autoAccept} onChange={e => setAutoAccept(e.target.checked)} />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Default Prep Time (minutes)</label>
        <input 
          type="number" 
          value={prepTime}
          onChange={e => setPrepTime(e.target.value)}
          className="w-full max-w-[200px] px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-brand-primary outline-none"
        />
        <p className="text-xs text-slate-500 mt-1">Sent to the aggregator as ETA if auto-accept is on.</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Assign to Branch</label>
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-brand-primary outline-none"
        >
          <option value="">-- Select Branch --</option>
          {branchesData?.branches?.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">All orders from this aggregator will be routed to this branch.</p>
      </div>

      <div className="pt-2">
        <button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-brand-primary text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-brand-primary/90 flex items-center gap-2"
        >
          <Save size={16} /> Save Settings
        </button>
      </div>
    </div>
  );
}

function WebhookTab({ provider }: { provider: string }) {
  // In a real implementation, this would show the tenant's exact webhook URL
  const webhookUrl = `https://api.dineiz.com/api/aggregators/webhook`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800">
        <p className="font-bold mb-1">Webhook Configuration</p>
        <p>Copy the URL below and paste it in your {provider} Partner Portal to enable live order delivery.</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Webhook URL</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            readOnly
            value={webhookUrl}
            className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono outline-none"
          />
          <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-orange-600 transition-colors">
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
