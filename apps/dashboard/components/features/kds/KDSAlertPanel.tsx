'use client';

import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { KdsAlert } from './hooks/useKDS';

interface KDSAlertPanelProps {
  alerts: KdsAlert[];
}

const ICON_MAP = {
  warning: <AlertTriangle size={14} className="shrink-0" style={{ color: '#f59e0b' }} />,
  info:    <Info        size={14} className="shrink-0" style={{ color: '#60a5fa' }} />,
  error:   <XCircle    size={14} className="shrink-0" style={{ color: '#ef4444' }} />,
};

const BORDER_MAP = {
  warning: 'rgba(245,158,11,0.3)',
  info:    'rgba(96,165,250,0.3)',
  error:   'rgba(239,68,68,0.3)',
};

export function KDSAlertPanel({ alerts }: KDSAlertPanelProps) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: 'rgba(30,41,59,0.5)' }}
      >
        <span className="text-white font-bold text-sm">Staff Alerts</span>
        {alerts.length > 0 && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-slate-600 text-center">No active alerts</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BORDER_MAP[alert.type]}`,
              }}
            >
              {ICON_MAP[alert.type]}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
