'use client';
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { LiveSummary } from './hooks/useOrderMonitor';

type SocketStatus = 'connected' | 'reconnecting' | 'offline';

interface MonitorFooterBarProps {
  summary: LiveSummary;
  socketStatus: SocketStatus;
}

export function MonitorFooterBar({ summary, socketStatus }: MonitorFooterBarProps) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () =>
      setTimeStr(
        new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()),
      );
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const systemIndicator = {
    connected:    { Icon: CheckCircle,    color: 'text-emerald-500', label: 'SYSTEM READY' },
    reconnecting: { Icon: AlertTriangle,  color: 'text-amber-500',   label: 'RECONNECTING...' },
    offline:      { Icon: XCircle,        color: 'text-red-500',     label: 'OFFLINE — Check connection' },
  }[socketStatus];

  return (
    <footer className="h-12 bg-white border-t border-slate-200 px-6 sticky bottom-0 z-40 shrink-0 flex items-center justify-between shadow-[0_-1px_10px_rgba(0,0,0,0.05)] w-full">
      {/* Stats */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's Orders:</span>
          <span className="text-sm font-black text-slate-900">{summary.todayOrderCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue:</span>
          <span className="text-sm font-black text-slate-900">
            {formatPKR(summary.todayRevenue)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Time:</span>
          <span className="text-sm font-black text-slate-900">
            {summary.avgPrepTime > 0 ? `${summary.avgPrepTime} min` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Progress:</span>
          <div className="bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-black text-amber-800">{summary.inProgressCount}</span>
          </div>
        </div>
      </div>

      {/* Right — system status + clock */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1 ${systemIndicator.color}`}>
          <systemIndicator.Icon size={16} />
          <span className="text-[10px] font-bold text-slate-600 uppercase">{systemIndicator.label}</span>
        </div>
        <div className="h-4 w-[1px] bg-slate-200" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{timeStr}</span>
        </div>
      </div>
    </footer>
  );
}
