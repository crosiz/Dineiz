'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Settings, Maximize2, UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react';

// Branch context is provided by the header BranchSelector (DashboardContext).
// This top bar intentionally has no branch dropdown.

interface MonitorTopBarProps {
  soundOn: boolean;
  onSoundToggle: (val: boolean) => void;
  lastUpdated: Date;
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  onRefresh: () => void;
}

function useLastUpdatedText(lastUpdated: Date) {
  const [text, setText] = useState('just now');
  useEffect(() => {
    const update = () => {
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 60) setText('just now');
      else setText(`${Math.floor(secs / 60)} min ago`);
    };
    update();
    const iv = setInterval(update, 10_000);
    return () => clearInterval(iv);
  }, [lastUpdated]);
  return text;
}

function Dropdown<T extends string | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T; icon?: React.ElementType }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentOpt = options.find(o => o.value === value);
  const current = currentOpt?.label ?? label;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative group">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <span className={`flex items-center gap-1.5 ${value ? 'text-[#ff5722]' : ''}`}>
          {currentOpt?.icon && <currentOpt.icon className="w-4 h-4" />}
          {current}
        </span>
        <ChevronDown size={18} className={`transition-transform text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
          {options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${value === opt.value
                  ? 'bg-orange-50 text-[#ff5722] font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon && <opt.icon className="w-4 h-4" />}
                {opt.label}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonitorTopBar({
  soundOn, onSoundToggle, lastUpdated,
  selectedType, onTypeChange,
  selectedStatus, onStatusChange,
  onRefresh,
}: MonitorTopBarProps) {
  const lastUpdatedText = useLastUpdatedText(lastUpdated);

  const typeOptions: { label: string; value: string | null; icon?: React.ElementType }[] = [
    { label: 'All Types', value: null },
    { label: 'Dine-In', value: 'DINE_IN', icon: UtensilsCrossed },
    { label: 'Takeaway', value: 'TAKEAWAY', icon: ShoppingBag },
    { label: 'Delivery', value: 'DELIVERY', icon: Bike },
  ];
  const statusOptions: { label: string; value: string | null }[] = [
    { label: 'All Status', value: null },
    { label: 'Pending', value: 'PENDING' },
    { label: 'In Kitchen', value: 'IN_KITCHEN' },
    { label: 'Ready', value: 'READY' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
      {/* Left — type & status filters */}
      <div className="flex items-center gap-4">
        <Dropdown
          label="All Types"
          options={typeOptions}
          value={selectedType}
          onChange={onTypeChange}
        />
        <Dropdown
          label="All Status"
          options={statusOptions}
          value={selectedStatus}
          onChange={onStatusChange}
        />
      </div>

      {/* Center — LIVE badge + last updated */}
      <div className="flex items-center gap-2">
        <div className="animate-pulse h-2 w-2 rounded-full bg-red-600" />
        <span className="text-xs font-black tracking-widest text-red-600">LIVE</span>
        <span className="text-[10px] text-slate-400 font-medium ml-2">
          Last updated: {lastUpdatedText}
        </span>
      </div>

      {/* Right — Sound + Refresh */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSoundToggle(!soundOn)}
          className="flex items-center bg-slate-100 rounded-full px-3 py-1.5 gap-2 border border-slate-200"
        >
          <span className="text-[10px] font-bold text-slate-600 uppercase">Sound</span>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${soundOn ? 'bg-[#b02f00]' : 'bg-slate-300'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${soundOn ? 'right-0.5' : 'left-0.5'}`} />
          </div>
          <span className={`text-[10px] font-bold uppercase ${soundOn ? 'text-[#b02f00]' : 'text-slate-400'}`}>
            {soundOn ? 'ON' : 'OFF'}
          </span>
        </button>
        <button
          onClick={onRefresh}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          title="Refresh"
        >
          <RefreshCw size={20} />
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen()
            } else {
              document.documentElement.requestFullscreen()
            }
          }}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          title="Toggle fullscreen"
        >
          <Maximize2 size={18} />
        </button>
        <button
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
