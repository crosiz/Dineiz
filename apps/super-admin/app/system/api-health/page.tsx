'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Layers,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ApiHealthPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = () => {
    fetch('/api/health/detailed')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d) setHealthData(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const isHighErrorRate = (healthData?.currentErrorRate || 0) > 5;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">API Health & System Monitoring</h1>
          <p className="text-sm text-slate-400">Real-time status of backend services, BullMQ queues, and error rates</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh 30s</span>
          </label>
          <button
            onClick={fetchHealth}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue Backup Banner Alert if any > 100 */}
      {healthData?.isAnyQueueBackedUp && (
        <div className="bg-amber-950/60 border border-amber-500/50 p-4 rounded-xl flex items-center gap-3 text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>WARNING: One or more BullMQ queues are backing up (&gt; 100 jobs waiting). Please inspect worker tasks.</span>
        </div>
      )}

      {/* System Components Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {healthData?.components?.map((comp: any) => (
          <div key={comp.key} className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-300 block">{comp.name}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">Latency: {comp.latencyMs} ms</span>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                comp.status === 'OPERATIONAL'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : comp.status === 'WARNING'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{comp.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* BullMQ Section */}
      <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white tracking-wide">BullMQ Background Queues</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {healthData?.queues?.map((q: any) => {
            const isBackedUp = q.length > 100;
            return (
              <div
                key={q.name}
                className={`p-4 rounded-xl border ${
                  isBackedUp ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <span className="text-xs font-bold block">{q.name}</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-extrabold">{q.length}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">jobs waiting</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 24-Hour Error Rate Chart */}
      <div className={`p-6 rounded-2xl shadow-xl border ${isHighErrorRate ? 'bg-rose-950/30 border-rose-800/80' : 'bg-slate-950/60 border-slate-800/80'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">24-Hour API Error Rate</h2>
            <p className="text-xs text-slate-400">Threshold limit: 5.0%</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isHighErrorRate ? 'bg-rose-500 text-slate-950' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            Current Rate: {healthData?.currentErrorRate}%
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthData?.errorRate24h || []}>
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(val: any) => [`${val}%`, 'Error Rate']} />
              <Line
                type="monotone"
                dataKey="errorRate"
                stroke={isHighErrorRate ? '#f43f5e' : '#10b981'}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
