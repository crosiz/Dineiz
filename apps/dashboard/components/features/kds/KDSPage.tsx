'use client';

import { useEffect, useState, useCallback } from 'react';
import { useKDS } from './hooks/useKDS';
import { KDSTopBar } from './KDSTopBar';
import { KDSStationTabs } from './KDSStationTabs';
import { KDSOrderCard } from './KDSOrderCard';
import { KDSAlertPanel } from './KDSAlertPanel';
import { KDSStatusBar } from './KDSStatusBar';
import { useUser } from '@/contexts/user-context';
import { KDSSettingsPanel } from './KDSSettingsPanel';
import { useKDSSettings } from './hooks/useKDSSettings';

// Dot-grid background pattern
const getDotGridStyle = (isDark: boolean): React.CSSProperties => ({
  backgroundImage: `radial-gradient(${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 1px, transparent 0)`,
  backgroundSize: '24px 24px',
});

// CSS animations injected once
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');

  @keyframes kds-pulse-once {
    0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
    100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
  }
  @keyframes kds-slide-in {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .kds-slide-in {
    animation: kds-slide-in 0.3s ease forwards;
  }
  /* hide scrollbar on station tabs */
  nav::-webkit-scrollbar { display: none; }
`;

export function KDSPage() {
  const { branch } = useUser();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, updateSettings, mounted } = useKDSSettings();
  const isDark = settings.theme === 'dark';

  const {
    orders,
    summary,
    stations,
    alerts,
    isLoading,
    socketStatus,
    removingIds,
    selectedStationId,
    setSelectedStationId,
    markItemReady,
    markOrderReady,
  } = useKDS(settings);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // F key shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        // Only if not typing in an input
        if (document.activeElement?.tagName === 'INPUT') return;
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleFullscreen]);

  // Sync fullscreen state with browser
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto-fullscreen on load
  useEffect(() => {
    if (mounted && settings.autoFullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      }
    }
  }, [mounted, settings.autoFullscreen]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />
        <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: isDark ? '#0A0A0F' : '#f8fafc' }}>
          <div style={{ height: '60px', background: isDark ? '#111120' : '#ffffff', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0' }} />
          <div style={{ height: '48px', background: isDark ? '#0A0A0F' : '#f1f5f9', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0' }} />
          <main className="flex-1 p-6" style={getDotGridStyle(isDark)}>
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`rounded-xl p-4 animate-pulse ${isDark ? 'bg-[#1A1A2E]' : 'bg-white shadow-sm'}`} style={{ height: '280px' }} />
              ))}
            </div>
          </main>
          <div style={{ height: '44px', background: isDark ? '#0A0A0F' : '#ffffff', borderTop: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0' }} />
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />

      <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: isDark ? '#0A0A0F' : '#f8fafc' }}>
        {/* Top bar */}
        <KDSTopBar
          isDark={isDark}
          branchName={branch?.name ?? ''}
          socketStatus={socketStatus}
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleTheme={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
        />

        <KDSSettingsPanel
          isDark={isDark}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          updateSettings={updateSettings}
        />

        {/* Station tabs */}
        <KDSStationTabs
          isDark={isDark}
          stations={stations}
          selectedStationId={selectedStationId}
          onSelect={setSelectedStationId}
        />

        {/* Main content area — scrollable, below the two fixed bars */}
        <main
          className="overflow-y-auto p-6 pb-[60px]"
          style={{
            marginTop: '108px', // 60px topbar + 48px tabs
            marginBottom: '44px', // status bar
            flex: 1,
            ...getDotGridStyle(isDark),
          }}
        >
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
              <div
                className="flex items-center justify-center w-20 h-20 rounded-full mb-4"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className={`font-semibold text-lg ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>No active orders</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-700' : 'text-slate-500'}`}>Waiting for new orders to come in…</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {/* Order cards */}
              {orders.map(order => (
                <KDSOrderCard
                  key={order.id}
                  isDark={isDark}
                  order={order}
                  isRemoving={removingIds.has(order.id)}
                  selectedStationId={selectedStationId}
                  onMarkItemReady={markItemReady}
                  onMarkOrderReady={markOrderReady}
                />
              ))}

              {/* Staff Alert panel — always shown as last card if there are alerts */}
              {alerts.length > 0 && (
                <KDSAlertPanel alerts={alerts} />
              )}
            </div>
          )}

          {/* Alert panel when no orders but there are alerts */}
          {orders.length === 0 && alerts.length > 0 && (
            <div className="mt-6 max-w-sm">
              <KDSAlertPanel alerts={alerts} />
            </div>
          )}
        </main>

        {/* Bottom status bar */}
        <KDSStatusBar isDark={isDark} summary={summary} socketStatus={socketStatus} />
      </div>
    </>
  );
}
