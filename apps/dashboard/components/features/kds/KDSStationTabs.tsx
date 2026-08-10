'use client';

import { KdsStationInfo } from './hooks/useKDS';

interface KDSStationTabsProps {
  stations: KdsStationInfo[];
  selectedStationId: string | null;
  onSelect: (id: string | null) => void;
  isDark: boolean;
}

export function KDSStationTabs({ stations, selectedStationId, onSelect, isDark }: KDSStationTabsProps) {
  return (
    <div
      className="fixed top-[60px] left-0 right-0 z-40 px-6 flex items-center overflow-x-auto no-scrollbar shadow-sm"
      style={{
        height: '48px',
        background: isDark ? '#0A0A0F' : '#f1f5f9',
        borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
      }}
    >
      <div className="flex gap-2 w-full max-w-full">
        {/* 'All Stations' Tab */}
        <button
          onClick={() => onSelect(null)}
          className="relative px-4 h-[48px] flex items-center justify-center font-bold text-sm tracking-wide transition-all whitespace-nowrap"
          style={{
            color: selectedStationId === null ? (isDark ? 'white' : '#0f172a') : (isDark ? '#64748b' : '#94a3b8'),
            opacity: selectedStationId === null ? 1 : 0.7,
          }}
        >
          <span>ALL STATIONS</span>
          {selectedStationId === null && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f97316]" />
          )}
        </button>

        {stations.map(st => {
          const isSelected = selectedStationId === st.id;
          return (
            <button
              key={st.id}
              onClick={() => onSelect(st.id)}
              className="relative px-4 h-[48px] flex items-center gap-2 font-bold text-sm tracking-wide transition-all whitespace-nowrap group"
              style={{
                color: isSelected ? (isDark ? 'white' : '#0f172a') : (isDark ? '#64748b' : '#94a3b8'),
                opacity: isSelected ? 1 : 0.7,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: st.color || '#f97316',
                  boxShadow: isSelected ? `0 0 10px ${st.color || '#f97316'}` : 'none',
                }}
              />
              <span>{st.name}</span>
              <span
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}></div> {st.orderCount}
              </span>
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f97316]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
