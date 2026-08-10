'use client';
import React, { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { AlertTriangle, Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { AnomalyList } from './_components/AnomalyList';
import { AnomalySettingsPanel } from './_components/AnomalySettingsPanel';
import { useBranchFilter } from '@/hooks/useBranchFilter';

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<string>('ALL'); // ALL, CRITICAL, HIGH, MEDIUM, RESOLVED
  const { branchId, queryParam } = useBranchFilter();

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      const res = await apiGet(`/api/anomalies${queryParam ? `?${queryParam}` : ''}`);
      setAnomalies(res as any[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [branchId]);

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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <AlertTriangle className="text-rose-500" size={32} />
            Anomalies
          </h1>
          <p className="text-slate-500 mt-2">Security & fraud detection for your restaurant operations.</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
        >
          <Settings size={18} />
          Settings
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 font-medium">
          <ShieldAlert size={20} className="text-rose-600" />
          <span><strong className="font-black">{criticalCount} critical anomalies</strong> require your immediate attention.</span>
        </div>
      )}

      {/* Summary Row */}
      <div className="flex flex-wrap gap-4">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('CRITICAL')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${filter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'}`}
        >
          Critical ({criticalCount})
        </button>
        <button 
          onClick={() => setFilter('HIGH')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${filter === 'HIGH' ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'}`}
        >
          High ({highCount})
        </button>
        <button 
          onClick={() => setFilter('MEDIUM')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${filter === 'MEDIUM' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}
        >
          Medium ({mediumCount})
        </button>
        <button 
          onClick={() => setFilter('RESOLVED')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${filter === 'RESOLVED' ? 'bg-green-600 text-white' : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'}`}
        >
          <CheckCircle2 size={16} />
          Resolved ({resolvedCount})
        </button>
      </div>

      <AnomalyList anomalies={filteredAnomalies} loading={loading} onRefresh={fetchAnomalies} />

      {showSettings && (
        <AnomalySettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
