'use client';

import { CheckCircle, WifiOff, Wifi } from 'lucide-react';
import { KdsSummary, SocketStatus } from './hooks/useKDS';

interface KDSStatusBarProps {
  summary: KdsSummary;
  socketStatus: SocketStatus;
  isDark: boolean;
}

function formatPrepTime(seconds: number): string {
  if (seconds === 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}M ${String(s).padStart(2, '0')}S` : `${m}M`;
}

export function KDSStatusBar({ summary, socketStatus, isDark }: KDSStatusBarProps) {
  const isConnected = socketStatus === 'connected';

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
      style={{
        height: '44px',
        background: isDark ? '#0A0A0F' : '#ffffff',
        borderTopWidth: '1px',
        fontFamily: 'monospace',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {/* Left: queue stats */}
      <div className="flex items-center gap-6">
        <div className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>IN QUEUE:</span>
          <span className="font-bold">{summary.inQueue}</span>
        </div>
        <div className={`w-px h-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <div className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>IN PROGRESS:</span>
          <span className="font-bold" style={{ color: '#f97316' }}>{summary.inProgress}</span>
        </div>
        <div className={`w-px h-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <div className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>COMPLETED TODAY:</span>
          <span className="font-bold">{summary.completedToday}</span>
        </div>
      </div>

      {/* Right: prep time + connection */}
      <div className="flex items-center gap-6">
        <div className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>AVG PREP TIME:</span>
          <span className="font-bold">{formatPrepTime(summary.avgPrepTimeSeconds)}</span>
        </div>
        <div className={`w-px h-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <CheckCircle size={14} style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981' }}>SYSTEM ONLINE</span>
            </>
          ) : socketStatus === 'reconnecting' ? (
            <>
              <Wifi size={14} style={{ color: '#f59e0b', animation: 'pulse 1s infinite' }} />
              <span style={{ color: '#f59e0b' }}>RECONNECTING...</span>
            </>
          ) : (
            <>
              <WifiOff size={14} style={{ color: '#ef4444' }} />
              <span style={{ color: '#ef4444' }}>OFFLINE (POLLING)</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
