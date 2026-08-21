'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';

export type ShiftDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

export const SHIFT_DATE_OPTIONS: { value: ShiftDatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * `toISOString().slice(0,10)` would give the *UTC* date — in Karachi that
 * makes everything before 5am look like yesterday. en-CA formats as
 * YYYY-MM-DD in the browser's own timezone, which is the restaurant's.
 */
const localDate = (d: Date) => d.toLocaleDateString('en-CA');

/**
 * Turns a preset into the `from`/`to` the API expects. `all` deliberately
 * returns nothing so the server sees no date filter at all — that's the
 * "every shift since this branch opened" case.
 */
export function resolveShiftRange(
  preset: ShiftDatePreset,
  customFrom?: string,
  customTo?: string,
): { from?: string; to?: string } {
  const today = new Date();

  switch (preset) {
    case 'today':
      return { from: localDate(today), to: localDate(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: localDate(y), to: localDate(y) };
    }
    case 'week': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: localDate(d), to: localDate(today) };
    }
    case 'month': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: localDate(d), to: localDate(today) };
    }
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined };
    case 'all':
    default:
      return {};
  }
}

/** Human label for the currently applied range, shown under the page title. */
export function describeShiftRange(preset: ShiftDatePreset, from?: string, to?: string) {
  if (preset === 'all') return 'All time';
  if (!from && !to) return 'All time';
  const fmt = (s?: string) =>
    s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  if (from && to && from === to) return fmt(from);
  return `${fmt(from)} — ${fmt(to)}`;
}

export function ShiftDateRange({
  preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo,
}: {
  preset: ShiftDatePreset;
  setPreset: (v: ShiftDatePreset) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = SHIFT_DATE_OPTIONS.find((o) => o.value === preset)?.label ?? 'Today';

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span className={preset === 'today' ? '' : 'font-medium'}>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[212px] py-1 overflow-hidden">
          {SHIFT_DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setPreset(opt.value);
                if (opt.value !== 'custom') setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                preset === opt.value ? 'text-slate-900 font-medium bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
              {preset === opt.value && <Check className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          ))}

          {preset === 'custom' && (
            <div className="px-3.5 py-3 border-t border-slate-100 flex flex-col gap-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-slate-300"
              />
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-slate-300"
              />
              <button
                onClick={() => setOpen(false)}
                disabled={!customFrom || !customTo}
                className="mt-1 bg-slate-900 text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
