'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { AlertTriangle, Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { AnomalyList } from './_components/AnomalyList';
import { AnomalySettingsPanel } from './_components/AnomalySettingsPanel';
import { useBranchFilter } from '@/hooks/useBranchFilter';

export default function AnomaliesPage() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<string>('ALL'); // ALL, CRITICAL, HIGH, MEDIUM, RESOLVED
  const { branchId, queryParam } = useBranchFilter();

  const { data: anomalies = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['anomalies', branchId ?? null],
    queryFn: () => apiGet<any[]>(`/api/anomalies${queryParam ? `?${queryParam}` : ''}`),
    placeholderData: keepPreviousData,
  });

  const fetchAnomalies = () => queryClient.invalidateQueries({ queryKey: ['anomalies'] });

  const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL' && a.status === 'OPEN').length;
  const highCount = anomalies.filter(a => a.severity === 'HIGH' && a.status === 'OPEN').length;
  const mediumCount = anomalies.filter(a => (a.severity === 'MEDIUM' || a.severity === 'LOW') && a.status === 'OPEN').length;
  const resolvedCount = anomalies.filter(a => a.status === 'RESOLVED' || a.status === 'FALSE_POSITIVE').length;

  const filteredAnomalies = anomalies.filter(a => {
    if (filter === 'ALL') return true;
    if (filter === 'CRITICAL') return a.severity === 'CRITICAL' && a.status === 'OPEN';
    if (filter === 'HIGH') return a.severity === 'HIGH' && a.status === 'OPEN';
    if (filter === 'MEDIUM') return (a.severity === 'MEDIUM' || a.severity === 'LOW') && a.status === 'OPEN';
    if (filter === 'RESOLVED') return a.status === 'RESOLVED' || a.status === 'FALSE_POSITIVE';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-rose-500" size={22} />
            Security & Operations Anomalies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Automated detection of irregular cash handling, discounts, and voids</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Settings size={15} />
          Rule Settings
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="bg-rose-50/80 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-medium">
          <ShieldAlert size={16} className="text-rose-600 shrink-0" />
          <span><strong className="font-bold">{criticalCount} critical anomaly events</strong> require review.</span>
        </div>
      )}

      {/* Segmented Filter Row */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit flex-wrap">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors ${filter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          All Events
        </button>
        <button 
          onClick={() => setFilter('CRITICAL')}
          className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 ${filter === 'CRITICAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Critical
          {criticalCount > 0 && <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">{criticalCount}</span>}
        </button>
        <button 
          onClick={() => setFilter('HIGH')}
          className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 ${filter === 'HIGH' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          High
          {highCount > 0 && <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-100 text-orange-700 font-bold">{highCount}</span>}
        </button>
        <button 
          onClick={() => setFilter('MEDIUM')}
          className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 ${filter === 'MEDIUM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Medium
          {mediumCount > 0 && <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-700 font-bold">{mediumCount}</span>}
        </button>
        <button 
          onClick={() => setFilter('RESOLVED')}
          className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 ${filter === 'RESOLVED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <CheckCircle2 size={13} className="text-emerald-600" />
          Resolved
          {resolvedCount > 0 && <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">{resolvedCount}</span>}
        </button>
      </div>

      <AnomalyList anomalies={filteredAnomalies} loading={loading} onRefresh={fetchAnomalies} />

      {showSettings && (
        <AnomalySettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

