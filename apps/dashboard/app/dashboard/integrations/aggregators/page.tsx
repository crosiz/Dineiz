'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { AggregatorConfigPanel } from './_components/AggregatorConfigPanel';
import { Settings2 } from 'lucide-react';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { AllBranchesBanner } from '@/components/AllBranchesBanner';

const FoodpandaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[#D70F64]">
    <path d="M4.224 0a3.14 3.14 0 00-3.14 3.127 3.1 3.1 0 001.079 2.36 11.811 11.811 0 00-2.037 6.639C.126 18.68 5.458 24 12 24c6.542 0 11.874-5.32 11.874-11.874a11.69 11.69 0 00-2.025-6.614 3.136 3.136 0 001.09-2.373A3.132 3.132 0 0019.8.012a3.118 3.118 0 00-2.636 1.438A11.792 11.792 0 0012.012.264c-1.845 0-3.595.419-5.152 1.174A3.133 3.133 0 004.224 0zM12 1.198c1.713 0 3.331.396 4.78 1.102a10.995 10.995 0 014.29 3.715 10.89 10.89 0 011.882 6.135c.011 6.039-4.901 10.951-10.94 10.951-6.04 0-10.951-4.912-10.951-10.951 0-2.277.694-4.386 1.88-6.135A11.08 11.08 0 017.232 2.3 10.773 10.773 0 0112 1.198zM7.367 6.345c-.853.012-1.743.292-2.28.653-1.031.682-2.29 2.156-2.085 4.181.191 2.025 1.785 3.283 2.612 3.283.826 0 1.234-.42 1.485-1.45.252-1.018 1.115-2.192 2.217-3.45s-.024-2.469-.024-2.469c-.393-.513-1.052-.727-1.755-.747a3.952 3.952 0 00-.17-.001zm9.233.007l-.17.001c-.702.02-1.358.233-1.746.752 0 0-1.126 1.21-.024 2.469 1.114 1.258 1.965 2.432 2.217 3.45.251 1.019.659 1.438 1.485 1.45.827 0 2.409-1.258 2.612-3.283.204-2.025-1.054-3.51-2.084-4.182-.544-.36-1.437-.643-2.29-.657zm-8.962 2c.348 0 .624.275.624.623-.012.335-.288.623-.624.623a.619.619 0 01-.623-.623c0-.348.276-.624.623-.624zm8.891 0c.348 0 .623.275.623.623-.012.335-.287.623-.623.623a.619.619 0 01-.623-.623c0-.348.288-.624.623-.624zm-4.541 4.025c-.527 0-2.06.096-2.06.587 0 .887 1.88 1.522 2.06 1.474.18.048 2.06-.587 2.06-1.474 0-.49-1.52-.587-2.06-.587zM9.076 15.17c0 1.414 1.294 2.564 2.912 2.564 1.618 0 2.924-1.15 2.924-2.564z"/>
  </svg>
);

const CareemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-[#47A23F]">
    <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8.9 6.5 2.5" />
    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const TalabatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[#FF5A00]">
    <path d="M14 2c-3 0-5 2.5-5 6v2H6v4h3v8h4v-8h4v-4h-4V8c0-1.5 1-2 2-2h2V2h-3z" />
  </svg>
);

export default function AggregatorsPage() {
  const [selectedProvider, setSelectedProvider] = useState<'foodpanda' | 'careem' | 'talabat' | null>(null);
  const { branchId, queryParam, isAllBranches } = useBranchFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['aggregators-integrations', branchId],
    queryFn: () => apiGet<{ integrations: any[] }>(`/api/aggregators/integrations${queryParam ? `?${queryParam}` : ''}`)
  });

  const getIntegration = (provider: string) => data?.integrations?.find((i: any) => i.provider === provider);

  const providers = [
    {
      id: 'foodpanda',
      name: 'Foodpanda',
      icon: <FoodpandaIcon />,
      description: 'Receive orders directly from Foodpanda into your Dineiz POS.',
    },
    {
      id: 'careem',
      name: 'Careem',
      icon: <CareemIcon />,
      description: 'Connect with Careem to process incoming delivery requests.',
    },
    {
      id: 'talabat',
      name: 'Talabat',
      icon: <TalabatIcon />,
      description: 'Accept Talabat orders automatically in your kitchen.',
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <AllBranchesBanner isAllBranches={isAllBranches} />
          
          <div className="shrink-0 flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Aggregator Integrations</h1>
              <p className="text-slate-500 text-sm">Receive orders from Foodpanda, Careem, and Talabat automatically.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-48 skeleton-shimmer border border-slate-200 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map(provider => {
                const integration = getIntegration(provider.id);
                const isConnected = integration?.status === 'CONNECTED';
                
                return (
                  <div key={provider.id} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                        {provider.icon}
                      </div>
                      {isConnected ? (
                        <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold tracking-wide uppercase">
                          Connected
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] font-bold tracking-wide uppercase">
                          Disconnected
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{provider.name}</h3>
                    <p className="text-sm text-slate-500 flex-1">{provider.description}</p>
                    
                    {isConnected && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-xs text-slate-500">Auto-accept: <span className="font-bold text-slate-700">{integration?.autoAccept ? 'ON' : 'OFF'}</span></div>
                        <div className="text-xs text-slate-500">Prep: <span className="font-bold text-slate-700">{integration?.defaultPrepTime}m</span></div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setSelectedProvider(provider.id as any)}
                      className="mt-6 w-full py-2.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      Configure
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {selectedProvider && (
        <AggregatorConfigPanel 
          provider={selectedProvider} 
          integration={getIntegration(selectedProvider)}
          onClose={() => {
            setSelectedProvider(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
